// app.js - Main application
// Requires: data.js (users, items, interactions, embeddingsJSON),
// Chart.js, PapaParse (if you later want chunk parsing), tfjs

// ---------- Utilities ----------
const $ = id => document.getElementById(id);
function formatMoney(x){ return '$' + (Number(x||0).toFixed(2)); }
function mean(arr){ if(!arr || arr.length===0) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }
function uniq(arr){ return Array.from(new Set(arr)); }
function tokenizeName(name){
  if(!name) return [];
  return name.toLowerCase()
    .replace(/[^\w\s]/g,' ')
    .split(/\s+/)
    .filter(t=>t.length>2);
}
function jaccard(a,b){
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter(x=>B.has(x)).length;
  const uni = new Set([...A,...B]).size;
  return uni===0?0:inter/uni;
}

// ---------- UI: data upload controls ----------
(function bindDataControls(){
  $('btn-open-upload').addEventListener('click', ()=>$('upload-panel').classList.toggle('hidden'));
  $('btn-auto-load').addEventListener('click', async ()=>{
    $('note-upload').innerText = "Attempting auto-load from repo...";
    // autoLoadIfPresent in data.js already attempted; but call again for feedback:
    await autoLoadIfPresent();
    updateLoadStatus();
    initAfterData();
    $('note-upload').innerText = "Auto-load attempted (check status lines).";
  });

  // file inputs
  $('f-users').addEventListener('change', (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
      parseUsersCSV(ev.target.result);
      $('st-users').innerText = `Users: loaded (local) — ${users.length}`;
      initAfterData();
    };
    r.readAsText(f);
  });
  $('f-items').addEventListener('change', (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
      parseItemsCSV(ev.target.result);
      $('st-items').innerText = `Items: loaded (local) — ${items.length}`;
      initAfterData();
    };
    r.readAsText(f);
  });
  $('f-inter').addEventListener('change', (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
      parseInteractionsCSV(ev.target.result);
      $('st-inter').innerText = `Interactions: loaded (local) — ${interactions.length}`;
      initAfterData();
    };
    r.readAsText(f);
  });
  $('f-emb').addEventListener('change', (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        embeddingsJSON = JSON.parse(ev.target.result);
        $('st-emb').innerText = `Embeddings: loaded (local)`;
      } catch(err){
        $('st-emb').innerText = `Embeddings: invalid JSON`;
      }
    };
    r.readAsText(f);
  });
})();

// Update load status display (called after auto-load/file-load)
function updateLoadStatus(){
  $('st-users').innerText = users.length ? `Users: ${users.length}` : 'Users: waiting';
  $('st-items').innerText = items.length ? `Items: ${items.length}` : 'Items: waiting';
  $('st-inter').innerText = interactions.length ? `Interactions: ${interactions.length}` : 'Interactions: waiting';
  $('st-emb').innerText = embeddingsJSON ? 'Embeddings: ready' : 'Embeddings: optional';
}

// Call this after any data load
function initAfterData(){
  updateLoadStatus();
  tryPopulateSelects();
  buildAuxiliaryMaps();
  drawGlobalEDA();
}

// try populate selects if items/users present
function tryPopulateSelects(){
  // content-based item select
  if(items.length>0){
    const sel = $('cb-item-select');
    sel.innerHTML = '<option value="">-- choose --</option>';
    items.forEach(it=> sel.appendChild(new Option(`${it.item_id} — ${it.name}`, it.item_id)));
  }
  // MF selects
  const mu = $('mf-user-select'), mi = $('mf-item-select');
  if(users.length>0){
    mu.innerHTML = '<option value="">-- user --</option>';
    users.forEach(u=> mu.appendChild(new Option(u.user_id,u.user_id)));
  }
  if(items.length>0){
    mi.innerHTML = '<option value="">-- item --</option>';
    items.forEach(it=> mi.appendChild(new Option(`${it.item_id} — ${it.name}`, it.item_id)));
  }
  // Two-tower loaders simply enable load button when items/interactions present
  $('tt-load').disabled = !(items.length>0 && interactions.length>0);
}

// ---------- Content-based implementation ----------
$('cb-find').addEventListener('click', ()=>{
  const id = $('cb-item-select').value;
  if(!id){ $('cb-note').innerText = "Please select an item."; return; }
  const source = items.find(it=>it.item_id===id);
  const sourceTokens = tokenizeName(source.name);
  // compute jaccard vs all items
  const scored = items.map(it=>{
    const t = tokenizeName(it.name);
    return { id: it.item_id, name: it.name, score: jaccard(sourceTokens, t) };
  }).filter(x=>x.id !== id).sort((a,b)=>b.score-a.score).slice(0,10);
  // render
  const tbody = $('cb-table').querySelector('tbody');
  tbody.innerHTML = '';
  scored.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${r.id}</td><td>${escapeHtml(r.name)}</td><td>${r.score.toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
  $('cb-note').innerText = `Found ${scored.length} similar items (Jaccard on tokens).`;
});

// small HTML escape
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

// ---------- Aux maps (for efficiency) ----------
let itemToUsers = new Map(); // item_id -> Set(user_id)
let userToItems = new Map(); // user_id -> Array(item_id)
let avgRatingMap = new Map(); // item_id -> avg rating
function buildAuxiliaryMaps(){
  itemToUsers = new Map();
  userToItems = new Map();
  const ratingsAcc = {}; // item -> list
  for(const it of items) itemToUsers.set(it.item_id, new Set());
  for(const row of interactions){
    if(!itemToUsers.has(row.item_id)) itemToUsers.set(row.item_id, new Set());
    itemToUsers.get(row.item_id).add(row.user_id);
    if(!userToItems.has(row.user_id)) userToItems.set(row.user_id, []);
    userToItems.get(row.user_id).push({item_id: row.item_id, rating: row.rating, ts: row.timestamp});
    ratingsAcc[row.item_id] = ratingsAcc[row.item_id] || [];
    ratingsAcc[row.item_id].push(+row.rating || 0);
  }
  avgRatingMap = new Map();
  Object.keys(ratingsAcc).forEach(id=>{
    avgRatingMap.set(id, mean(ratingsAcc[id]));
  });
}

// ---------- GLOBAL EDA: price vs avg rating scatter ----------
let edaChart = null;
function drawGlobalEDA(){
  if(items.length===0) return;
  const points = items.map(it=>{
    const avg = avgRatingMap.has(it.item_id) ? avgRatingMap.get(it.item_id) : 0;
    return { x: it.price || 0, y: avg, id: it.item_id, name: it.name };
  });
  const ctx = $('eda-scatter').getContext('2d');
  if(edaChart) edaChart.destroy();
  edaChart = new Chart(ctx, {
    type:'scatter',
    data:{
      datasets:[{
        label:'Items: Price vs Avg Rating',
        data: points.map(p=>({x:p.x, y:p.y, id:p.id, name:p.name})),
        backgroundColor:'#ff66b2'
      }]
    },
    options:{
      responsive:true,
      plugins:{
        tooltip:{
          callbacks:{
            label: ctx=>{
              const p = points[ctx.dataIndex];
              return `${p.id} — ${p.name} : $${p.x} / ${p.y.toFixed(2)}`;
            }
          }
        }
      },
      scales:{
        x:{title:{display:true,text:'Price ($)'}},
        y:{title:{display:true,text:'Avg Rating'}}
      },
      onClick: (evt, elems)=>{
        if(!elems.length) return;
        const idx = elems[0].index;
        const id = points[idx].id;
        // set cb-item-select and show its history automatically
        const sel = $('cb-item-select');
        if(sel) sel.value = id;
        // show item history: reuse earlier functionality (display in content-based? we'll show item history in two places)
        showItemHistory(id);
      }
    }
  });
  $('eda-note').innerText = `EDA: ${items.length} items plotted. Click a point to jump to the item.`;
}

// ---------- item purchase history helper (used by EDA and item selection) ----------
function showItemHistory(item_id){
  // fill history table (re-use a table from existing UI)
  // We will show in a modal-less inline area: prefer to repurpose Two-Tower left historical top10 (for now, use alert or console or update cb-note)
  const rows = interactions.filter(r=>r.item_id===item_id);
  // for simplicity show a quick note
  $('cb-note').innerText = `Item ${item_id} has ${rows.length} purchase records.`;
  // Also set cb-item-select to this and find similar automatically
  const sel = $('cb-item-select');
  if(sel) sel.value = item_id;
}

// ---------- MATRIX FACTORIZATION MODULE ----------

// We'll implement a simple matrix factorization with user & item embeddings (variables) and MSE loss.
// For performance, we sample a subset if interactions are very large.

let MF = { model: null, trained: false, lossHistory: [] };

function prepareMFData(maxSamples=50000){
  // Build maps for user/item indices
  const usersList = uniq(interactions.map(r=>r.user_id));
  const itemsList = uniq(interactions.map(r=>r.item_id));
  const userIndex = new Map(usersList.map((u,i)=>[u,i]));
  const itemIndex = new Map(itemsList.map((it,j)=>[it,j]));
  // sample interactions up to maxSamples
  const sample = interactions.slice(0, maxSamples);
  const xs_u = sample.map(r=>userIndex.get(r.user_id));
  const xs_i = sample.map(r=>itemIndex.get(r.item_id));
  const ys = sample.map(r=>+r.rating || 0);
  return {usersList, itemsList, userIndex, itemIndex, xs_u, xs_i, ys};
}

async function trainMF(epochs=12, latent=16, batchSize=256){
  if(interactions.length===0){ $('mf-status').innerText = "No interactions to train on."; return; }
  $('mf-status').innerText = "Preparing data...";
  const data = prepareMFData(20000);
  const nUsers = data.usersList.length, nItems = data.itemsList.length;
  // create variables
  const k = latent;
  // initialize small embeddings as variables
  const userEmb = tf.variable(tf.randomNormal([nUsers,k],0,0.1));
  const itemEmb = tf.variable(tf.randomNormal([nItems,k],0,0.1));
  const userBias = tf.variable(tf.zeros([nUsers]));
  const itemBias = tf.variable(tf.zeros([nItems]));
  const globalBias = tf.scalar(mean(data.ys));
  const optimizer = tf.train.adam(0.01);

  MF = { userEmb, itemEmb, userBias, itemBias, globalBias, optimizer, trained:false, lossHistory:[] , maps: data };

  // convert indices to tensors
  const uArr = tf.tensor1d(data.xs_u,'int32');
  const iArr = tf.tensor1d(data.xs_i,'int32');
  const yArr = tf.tensor1d(data.ys,'float32');

  // loss training loop
  const numExamples = data.xs_u.length;
  const stepsPerEpoch = Math.max(1, Math.floor(numExamples / batchSize));
  $('mf-status').innerText = `Training MF: ${epochs} epochs, ${numExamples} examples...`;
  const lossCanvas = document.getElementById('mf-loss-chart').getContext('2d');
  let lossChart = new Chart(lossCanvas, {type:'line',data:{labels:[],datasets:[{label:'MF Loss',data:[],borderColor:'#e60073',fill:false}]},options:{responsive:true}});

  for(let epoch=0; epoch<epochs; epoch++){
    let epochLoss = 0;
    for(let step=0; step<stepsPerEpoch; step++){
      const start = step*batchSize;
      const end = Math.min(numExamples, start+batchSize);
      const uBatch = uArr.slice(start, end - start);
      const iBatch = iArr.slice(start, end - start);
      const yBatch = yArr.slice(start, end - start);
      // training step
      const batchLoss = await optimizer.minimize(() => {
        const uEmb = tf.gather(userEmb, uBatch);
        const iEmb = tf.gather(itemEmb, iBatch);
        const preds = tf.sum(tf.mul(uEmb, iEmb),1)
          .add(tf.gather(userBias, uBatch))
          .add(tf.gather(itemBias, iBatch))
          .add(globalBias);
        const loss = tf.losses.meanSquaredError(yBatch, preds);
        return loss;
      }, true);
      const l = batchLoss.dataSync()[0];
      epochLoss += l;
      tf.dispose(batchLoss);
      tf.dispose([uBatch,iBatch,yBatch]);
    }
    const avgLoss = epochLoss / stepsPerEpoch;
    MF.lossHistory.push(avgLoss);
    // update chart
    lossChart.data.labels.push(`e${epoch+1}`);
    lossChart.data.datasets[0].data.push(avgLoss);
    lossChart.update();
    $('mf-status').innerText = `MF Training: epoch ${epoch+1}/${epochs} — loss ${avgLoss.toFixed(4)}`;
    await tf.nextFrame();
  }

  // attach model object
  MF.trained = true;
  MF.userIndex = data.userIndex;
  MF.itemIndex = data.itemIndex;
  MF.usersList = data.usersList;
  MF.itemsList = data.itemsList;
  $('mf-status').innerText = "Model training completed successfully!";
  $('mf-predict').disabled = false;
}

$('mf-train').addEventListener('click', async ()=>{
  const epochs = Math.max(1, parseInt($('mf-epochs').value || 12));
  $('mf-predict').disabled = true;
  await trainMF(epochs, 32, 512);
});

// predict rating using MF model
$('mf-predict').addEventListener('click', ()=>{
  const uid = $('mf-user-select').value;
  const iid = $('mf-item-select').value;
  if(!uid || !iid || !MF.trained){ alert('Select user & item and train the model first.'); return; }
  const ui = MF.userIndex.get(uid);
  const ii = MF.itemIndex.get(iid);
  if(ui===undefined || ii===undefined){ alert('User or item not in training index'); return; }
  tf.tidy(()=>{
    const uEmb = tf.gather(MF.userEmb, tf.tensor1d([ui], 'int32'));
    const iEmb = tf.gather(MF.itemEmb, tf.tensor1d([ii], 'int32'));
    const pred = tf.sum(tf.mul(uEmb, iEmb),1)
      .add(tf.gather(MF.userBias, tf.tensor1d([ui],'int32')))
      .add(tf.gather(MF.itemBias, tf.tensor1d([ii],'int32')))
      .add(MF.globalBias);
    const val = pred.dataSync()[0];
    $('mf-pred-note').innerText = `Predicted rating for User ${uid} on "${iid}" : ${val.toFixed(2)} / 5`;
  });
});

// ---------- TWO-TOWER Module ----------

// We'll implement a simple two-tower: user id -> embedding -> MLP; item id -> embedding -> MLP; score = dot(uVec, iVec).
// Loss: in-batch softmax / contrastive via cross-entropy will be approximated by pairwise hinge-like loss for clarity.

let TT = { model: null, trained:false, lossHistory: [] };

$('tt-load').addEventListener('click', ()=>{
  if(items.length===0||interactions.length===0){ alert('Need items and interactions loaded'); return; }
  $('tt-status').innerText = 'Two-Tower ready to train (data loaded).';
  $('tt-train').disabled = false;
});

$('tt-train').addEventListener('click', async ()=>{
  $('tt-train').disabled = true;
  $('tt-status').innerText = 'Training Two-Tower...';
  await trainTwoTower();
  $('tt-test').disabled = false;
  $('tt-status').innerText = 'Two-Tower training completed.';
});

// For speed we train on a subset
async function trainTwoTower(params={epochs:12, emb:32, batch:512}){
  const usersList = uniq(interactions.map(r=>r.user_id));
  const itemsList = uniq(items.map(i=>i.item_id));
  const uIndex = new Map(usersList.map((u,i)=>[u,i]));
  const iIndex = new Map(itemsList.map((it,j)=>[it,j]));
  const numU = usersList.length, numI = itemsList.length;
  const k = params.emb;

  // Prepare training pairs (u, pos_i)
  const pairs = interactions.map(r=>({u:uIndex.get(r.user_id), i:iIndex.get(r.item_id)})).filter(p=>p.u!=null && p.i!=null);
  const samplePairs = pairs.slice(0, Math.min(30000, pairs.length)); // limit for browser

  // Variables: userEmb [numU,k], itemEmb [numI,k]
  const userEmb = tf.variable(tf.randomNormal([numU,k],0,0.1));
  const itemEmb = tf.variable(tf.randomNormal([numI,k],0,0.1));
  const optimizer = tf.train.adam(0.005);

  TT = {userEmb, itemEmb, usersList, itemsList, uIndex, iIndex, trained:false, lossHistory:[]};

  // loss: for batch of pairs (u, i_pos), sample neg items in-batch and compute logistic loss
  const n = samplePairs.length;
  const batchSize = params.batch;
  const steps = Math.max(1, Math.floor(n / batchSize));
  // chart for loss
  const ctx = $('tt-loss-chart').getContext('2d');
  let lossChart = new Chart(ctx, {type:'line',data:{labels:[],datasets:[{label:'TT Loss',data:[],borderColor:'#e60073',fill:false}]},options:{responsive:true}});

  for(let epoch=0; epoch<params.epochs; epoch++){
    let sumLoss = 0;
    for(let s=0; s<steps; s++){
      const start = s*batchSize, end=Math.min(n, start+batchSize);
      const batch = samplePairs.slice(start,end);
      const uIdxs = tf.tensor1d(batch.map(x=>x.u),'int32');
      const iPosIdxs = tf.tensor1d(batch.map(x=>x.i),'int32');
      // in-batch negatives: use other items in batch as negatives
      const lossT = optimizer.minimize(()=> {
        // uEmb [B,k]
        const uE = tf.gather(userEmb, uIdxs);
        const posE = tf.gather(itemEmb, iPosIdxs);
        // logits pos = sum(u*pos)
        const posLogits = tf.sum(tf.mul(uE, posE),1).reshape([-1,1]); // [B,1]
        // compute other items as negatives by computing dot(u, itemEmb^T) limited to sample batch items
        // For efficiency we compute in-batch negatives: gather all posE for the batch as candidates
        const candidateE = posE; // [B,k]
        const logits = tf.matMul(uE, candidateE, false, true); // [B,B]
        // make labels where diagonal is positive (one-hot)
        const labels = tf.eye(end-start);
        // apply softmax crossentropy per row
        const xent = tf.losses.softmaxCrossEntropy(labels, logits, {fromLogits:true});
        return xent;
      }, true);
      const l = lossT.dataSync()[0];
      sumLoss += l;
      tf.dispose([uIdxs,iPosIdxs,lossT]);
    }
    const avgLoss = sumLoss/steps;
    TT.lossHistory.push(avgLoss);
    lossChart.data.labels.push(`e${epoch+1}`);
    lossChart.data.datasets[0].data.push(avgLoss);
    lossChart.update();
    $('tt-status').innerText = `Two-Tower training: epoch ${epoch+1}/${params.epochs} — loss ${avgLoss.toFixed(4)}`;
    await tf.nextFrame();
  }

  TT.trained = true;
  $('tt-status').innerText = 'Two-Tower model trained successfully!';
  // After training, render 2D projection of a sample of item embeddings
  renderItemEmbeddingProjection();
}

// project item embeddings -> 2D using SVD on a small sample (in JS)
function renderItemEmbeddingProjection(sampleSize=500){
  if(!TT.trained) return;
  // get item embeddings values for sample
  const totalItems = TT.itemsList.length;
  const idxs = [];
  for(let i=0;i<Math.min(sampleSize,totalItems); i++) idxs.push(i);
  const itemTensor = tf.gather(TT.itemEmb, tf.tensor1d(idxs,'int32'));
  // perform SVD via tf.svd
  const mat = itemTensor; // shape [m,k]
  const {s, u, v} = tf.svd(mat, true);
  // 2D coords = u[:,0:2] * s[0:2]
  const u2 = u.slice([0,0],[u.shape[0],2]);
  const sVals = s.slice([0],[2]);
  const coords = u2.mul(sVals.reshape([1,2]));
  coords.array().then(arr=>{
    // draw scatter inside embed-proj box
    const box = $('tt-embed-proj');
    box.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = box.clientWidth || 600;
    canvas.height = 240;
    box.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    // scale coords for plotting
    const xs = arr.map(a=>a[0]); const ys = arr.map(a=>a[1]);
    const minx=Math.min(...xs), maxx=Math.max(...xs), miny=Math.min(...ys), maxy=Math.max(...ys);
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<xs.length;i++){
      const x = ((xs[i]-minx)/(maxx-minx||1))* (canvas.width-20) + 10;
      const y = ((ys[i]-miny)/(maxy-miny||1))* (canvas.height-20) + 10;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fillStyle='#e60073'; ctx.fill();
    }
    $('tt-status').innerText += ' • Embedding projection rendered.';
    itemTensor.dispose(); coords.dispose(); u.dispose(); v.dispose(); s.dispose();
  });
}

// Two-Tower TEST: randomly pick user with >=20 ratings and show 3 columns
$('tt-test').addEventListener('click', ()=>{
  // pick user with >=20 interactions
  const counts = {};
  interactions.forEach(r=> counts[r.user_id] = (counts[r.user_id]||0)+1);
  const candidates = Object.keys(counts).filter(u=>counts[u]>=20);
  if(candidates.length===0){ alert('No user with >=20 ratings in data subset'); return; }
  const userId = candidates[Math.floor(Math.random()*candidates.length)];
  // left: historical top10 by rating then recency
  const hist = (userToItems.get(userId)||[]).sort((a,b)=> (b.rating - a.rating) || (new Date(b.ts||0) - new Date(a.ts||0))).slice(0,10);
  const leftT = $('tt-left').querySelector('tbody'); leftT.innerHTML='';
  hist.forEach((h,i)=> leftT.appendChild(trRow(i+1, h.item_id, `${h.rating.toFixed(2)}`, getYearForItem(h.item_id))));
  // middle: basic embedding table (if embeddingsJSON exists use item vectors else use avg rating)
  const midT = $('tt-mid').querySelector('tbody'); midT.innerHTML='';
  if(embeddingsJSON && embeddingsJSON.item_embeddings){
    // compute dot of user historical mean vector with item vectors (simple)
    const userVec = computeUserVectorFromHistory(userId);
    const scores = items.map(it=>{
      const vec = embeddingsJSON.item_embeddings[it.item_id];
      const s = vec ? cosineVec(userVec, vec) : 0;
      return {id: it.item_id, name: it.name, score: s, year: getYearForItem(it.item_id)};
    }).sort((a,b)=>b.score-a.score).slice(0,10);
    scores.forEach((r,i)=> midT.appendChild(trRow(i+1, r.id, r.score.toFixed(3), r.year)));
  } else {
    // fallback: top by avg rating
    const arr = items.map(it=> ({id:it.item_id, name:it.name, score: avgRatingMap.get(it.item_id)||0, year:getYearForItem(it.item_id)}))
      .sort((a,b)=>b.score-a.score).slice(0,10);
    arr.forEach((r,i)=> midT.appendChild(trRow(i+1, r.id, r.score.toFixed(2), r.year)));
  }

  // right: use TT model itemEmb dot with userEmb (if trained)
  const rightT = $('tt-right').querySelector('tbody'); rightT.innerHTML='';
  if(TT.trained){
    // compute user embedding from historical items (mean item embeddings)
    const userVec = computeUserVecFromTT(userId);
    // compute dot to all itemEmb tensors (we will pull small sample for speed)
    const scores = [];
    for(let j=0;j<TT.itemsList.length;j++){
      const id = TT.itemsList[j];
      const it = items.find(x=>x.item_id===id);
      // get embedding as array
      const emb = TT.itemEmb.gather([j]).arraySync()[0];
      const s = cosineVec(userVec, emb);
      scores.push({id, name: it?it.name:id, score: s, year: getYearForItem(id)});
    }
    scores.sort((a,b)=>b.score-a.score);
    scores.slice(0,10).forEach((r,i)=> rightT.appendChild(trRow(i+1, r.id, r.score.toFixed(3), r.year)));
  } else {
    // model not trained — show message
    rightT.innerHTML = `<tr><td colspan="4">Two-Tower model not trained yet.</td></tr>`;
  }

  $('tt-test-results').classList.remove('hidden');
  $('tt-status').innerText = `Test run for user ${userId} — left: historical, mid: basic, right: DL`;
});

// small helpers used in test
function trRow(rank, itemId, score, year){
  const tr = document.createElement('tr');
  const it = items.find(x=>x.item_id===itemId);
  tr.innerHTML = `<td>${rank}</td><td>${escapeHtml(itemId)}</td><td>${escapeHtml(it?it.name:itemId)}</td><td>${score}</td><td>${year||''}</td>`;
  return tr;
}
function getYearForItem(itemId){
  // try parse year from name if present (e.g., "Toy (2005)")
  const it = items.find(x=>x.item_id===itemId);
  if(!it) return '';
  const m = (it.name||'').match(/(19|20)\d{2}/);
  return m? m[0] : '';
}
function computeUserVectorFromHistory(userId){
  // mean of precomputed embeddingsJSON.item_embeddings for items the user bought
  const history = userToItems.get(userId) || [];
  const vecs = [];
  for(const h of history){
    const v = embeddingsJSON && embeddingsJSON.item_embeddings ? embeddingsJSON.item_embeddings[h.item_id] : null;
    if(v) vecs.push(v);
  }
  if(vecs.length===0) return new Array(Object.values(embeddingsJSON.item_embeddings)[0].length).fill(0);
  const k = vecs[0].length;
  const meanVec = new Array(k).fill(0);
  for(const v of vecs) for(let i=0;i<k;i++) meanVec[i]+=v[i];
  for(let i=0;i<k;i++) meanVec[i]/=vecs.length;
  return meanVec;
}
function computeUserVecFromTT(userId){
  // average itemEmb tensors for this user's items based on TT.itemEmb
  const history = userToItems.get(userId) || [];
  if(history.length===0) return new Array(TT.itemEmb.shape[1]).fill(0);
  // find indices
  const idxs = history.map(h=> TT.itemsList.indexOf(h.item_id)).filter(i=>i>=0);
  if(idxs.length===0) return new Array(TT.itemEmb.shape[1]).fill(0);
  const t = tf.gather(TT.itemEmb, tf.tensor1d(idxs,'int32'));
  const mean = t.mean(0);
  const arr = mean.arraySync();
  t.dispose(); mean.dispose();
  return arr;
}
function cosineVec(a,b){
  let dot=0,na=0,nb=0;
  const n = Math.min(a.length,b.length);
  for(let i=0;i<n;i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  if(na===0||nb===0) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}

// ---------- Startup: try initialize UI if data already loaded ----------
window.addEventListener('load', ()=>{
  setTimeout(()=>{ // slight delay to allow data.js autoLoad
    updateLoadStatus();
    initAfterData();
  }, 600);
});
