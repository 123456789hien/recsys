// app.js — main application
// Uses data.js's dataAPI for loading/parsing.
// Implements Content-based, MF (tfjs), Two-Tower (tfjs), EDA, Top-N scoring.

// local references to data arrays
let users = [];
let items = [];
let interactions = [];
let embeddingsObj = { item_embeddings: null, user_embeddings: null };

// auxiliary maps
let avgRatingMap = new Map();
let itemToUsers = new Map();
let userToItems = new Map();

// utility helpers
const $ = id => document.getElementById(id);
function mean(arr){ return arr && arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function uniq(arr){ return Array.from(new Set(arr)); }
function escapeHtml(s){ if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

// init UI handlers
(function bindUI(){
  $('btn-open-upload').addEventListener('click', ()=> $('upload-panel').classList.toggle('hidden'));
  $('btn-auto-load').addEventListener('click', async ()=>{
    $('note-upload').innerText = 'Auto-loading...';
    await dataAPI.autoLoadAll();
    refreshDataFromAPI();
    $('note-upload').innerText = 'Auto-load attempted. Check status lines.';
  });

  $('f-users').addEventListener('change', async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    await dataAPI.parseCSVFile(f,'users');
    refreshDataFromAPI();
    $('st-users').innerText = `Users: ${users.length} (uploaded)`;
  });
  $('f-items').addEventListener('change', async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    await dataAPI.parseCSVFile(f,'items');
    refreshDataFromAPI();
    $('st-items').innerText = `Items: ${items.length} (uploaded)`;
  });
  $('f-inter').addEventListener('change', async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    await dataAPI.parseCSVFile(f,'interactions');
    refreshDataFromAPI();
    $('st-inter').innerText = `Interactions: ${interactions.length} (uploaded)`;
  });
  $('f-emb').addEventListener('change', (e)=>{
    const fr = new FileReader();
    fr.onload = ev=>{
      try{
        const j = JSON.parse(ev.target.result);
        embeddingsObj.item_embeddings = j.item_embeddings || j.itemEmbeddings || j.items || j;
        embeddingsObj.user_embeddings = j.user_embeddings || j.userEmbeddings || null;
        $('st-emb').innerText = `Embeddings: loaded (uploaded)`;
      }catch(err){
        $('st-emb').innerText = 'Embeddings: invalid JSON';
      }
    };
    fr.readAsText(e.target.files[0]);
  });

  // content-based
  $('cb-find').addEventListener('click', doContentBased);

  // MF buttons
  $('mf-train').addEventListener('click', async ()=>{
    const epochs = Math.max(1, parseInt($('mf-epochs').value || 8));
    await trainMatrixFactorization(epochs);
  });
  $('mf-predict').addEventListener('click', mfPredict);

  // Two-Tower
  $('tt-load').addEventListener('click', ()=>{
    if(!items.length || !interactions.length){ alert('Load Items and Interactions first.'); return; }
    $('tt-status').innerText = 'Two-Tower: ready to train.';
    $('tt-train').disabled = false;
  });
  $('tt-train').addEventListener('click', async ()=>{
    $('tt-train').disabled = true;
    await trainTwoTower({epochs:8, emb:32, batch:512});
    $('tt-test').disabled = false;
  });
  $('tt-test').addEventListener('click', ()=> twoTowerTest());

  // TopN
  $('btn-topn').addEventListener('click', computeTopN);

})();

// refresh local copies from dataAPI
function refreshDataFromAPI(){
  users = dataAPI.usersArr();
  items = dataAPI.itemsArr();
  interactions = dataAPI.interactionsArr();
  const emb = dataAPI.embeddingsObj();
  if(emb) embeddingsObj = emb;
  buildAuxMaps();
  populateUI();
  drawEDA(); // global EDA
}

// populate selects and buttons
function populateUI(){
  // location buttons
  const locs = uniq(users.map(u=>u.location)).filter(Boolean).slice(0,50);
  const container = $('location-buttons'); container.innerHTML = '';
  const allBtn = document.createElement('button'); allBtn.className='btn secondary'; allBtn.innerText='All'; allBtn.onclick = ()=> $('location-note').innerText='Filter: All'; container.appendChild(allBtn);
  locs.forEach(l=>{
    const b = document.createElement('button'); b.className='btn secondary'; b.innerText = l; b.onclick = ()=> $('location-note').innerText = `Filter: ${l}`; container.appendChild(b);
  });

  // item selects
  const sel = $('select-item'); sel.innerHTML = '<option value="">-- choose --</option>';
  const cbsel = $('cb-item-select'); if(cbsel) cbsel.innerHTML = '<option value="">-- choose --</option>';
  const mfItem = $('mf-item'); if(mfItem) mfItem.innerHTML = '<option value="">-- item --</option>';
  items.slice(0,5000).forEach(it=>{
    const opt = new Option(`${it.item_id} — ${it.name}`, it.item_id);
    sel.appendChild(opt.cloneNode(true));
    if(cbsel) cbsel.appendChild(opt.cloneNode(true));
    if(mfItem) mfItem.appendChild(opt.cloneNode(true));
  });

  // mf user select
  const mfUser = $('mf-user'); if(mfUser) { mfUser.innerHTML = '<option value="">-- user --</option>'; users.slice(0,5000).forEach(u=>mfUser.appendChild(new Option(u.user_id,u.user_id))); }
}

// build auxiliary maps (avg rating, item->users, user->items)
function buildAuxMaps(){
  avgRatingMap = new Map(); itemToUsers = new Map(); userToItems = new Map();
  const ratingAcc = {};
  interactions.forEach(r=>{
    if(!itemToUsers.has(r.item_id)) itemToUsers.set(r.item_id, new Set());
    itemToUsers.get(r.item_id).add(r.user_id);
    if(!userToItems.has(r.user_id)) userToItems.set(r.user_id, []);
    userToItems.get(r.user_id).push({ item_id: r.item_id, rating: r.rating, ts: r.timestamp });
    ratingAcc[r.item_id] = ratingAcc[r.item_id] || []; ratingAcc[r.item_id].push(+r.rating || 0);
  });
  Object.keys(ratingAcc).forEach(it=> avgRatingMap.set(it, mean(ratingAcc[it])));
}

// ========== CONTENT-BASED ==========

// tokenization + fallback to embeddings if present
function tokenize(s){
  if(!s) return [];
  return s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(t=>t.length>2);
}
function jaccard(a,b){ if(!a||!b) return 0; const A = new Set(a), B = new Set(b); const inter = [...A].filter(x=>B.has(x)).length; const uni = new Set([...A,...B]).size; return uni? inter/uni : 0; }

function doContentBased(){
  const sel = $('select-item').value;
  if(!sel){ $('cb-note').innerText = 'Choose an item first.'; return; }
  // if embeddings exist: use cosine similarity of item embeddings; else use token Jaccard on name
  let scored = [];
  if(embeddingsObj && embeddingsObj.item_embeddings && embeddingsObj.item_embeddings[sel]){
    const anchor = embeddingsObj.item_embeddings[sel];
    items.forEach(it=>{
      if(it.item_id===sel) return;
      const vec = embeddingsObj.item_embeddings[it.item_id];
      const sim = vec ? cosine(anchor, vec) : 0;
      scored.push({ id: it.item_id, name: it.name, sim, avgRating: avgRatingMap.get(it.item_id)||0, price: it.price||0 });
    });
  } else {
    const anchorTokens = tokenize((items.find(x=>x.item_id===sel)||{}).name || '');
    items.forEach(it=>{
      if(it.item_id===sel) return;
      const sim = jaccard(anchorTokens, tokenize(it.name));
      scored.push({ id: it.item_id, name: it.name, sim, avgRating: avgRatingMap.get(it.item_id)||0, price: it.price||0 });
    });
  }
  scored.sort((a,b)=>b.sim - a.sim);
  const top = scored.slice(0,10);
  const tbody = $('cb-table').querySelector('tbody'); tbody.innerHTML = '';
  top.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}</td><td>${r.sim.toFixed(3)}</td><td>${(r.avgRating||0).toFixed(2)}</td><td>${formatMoney(r.price)}</td>`;
    tbody.appendChild(tr);
  });
  $('cb-note').innerText = `Found ${top.length} similar items.`;
}

function cosine(a,b){
  if(!a||!b) return 0;
  let dot=0,na=0,nb=0; const n = Math.min(a.length,b.length);
  for(let i=0;i<n;i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  if(na===0||nb===0) return 0;
  return dot/(Math.sqrt(na)*Math.sqrt(nb));
}
function formatMoney(x){ return '$' + (Number(x||0).toFixed(2)); }

// ========== MATRIX FACTORIZATION (simple variable-based) ==========
let MF = { userIndex: null, itemIndex: null, userEmb:null, itemEmb:null, userBias:null, itemBias:null, globalBias:0, trained:false, lossHistory:[] };

async function trainMatrixFactorization(epochs=8, latent=32, batchSize=1024, sampleLimit=50000){
  if(interactions.length===0){ alert('No interactions loaded'); return; }
  $('mf-status').innerText = 'Preparing MF data...';
  // build index maps
  const uIds = uniq(interactions.map(r=>r.user_id));
  const iIds = uniq(interactions.map(r=>r.item_id));
  const userIndex = new Map(uIds.map((u,i)=>[u,i]));
  const itemIndex = new Map(iIds.map((it,j)=>[it,j]));

  // sample interactions to avoid browser overload
  const sample = interactions.slice(0, Math.min(sampleLimit, interactions.length));
  const uIdxs = sample.map(r=>userIndex.get(r.user_id));
  const iIdxs = sample.map(r=>itemIndex.get(r.item_id));
  const ys = sample.map(r=>+r.rating || 0);

  const nUsers = uIds.length, nItems = iIds.length;
  const k = Math.min(latent, 64);

  // variables
  const userEmb = tf.variable(tf.randomNormal([nUsers,k],0,0.1));
  const itemEmb = tf.variable(tf.randomNormal([nItems,k],0,0.1));
  const userBias = tf.variable(tf.zeros([nUsers]));
  const itemBias = tf.variable(tf.zeros([nItems]));
  const globalBias = tf.scalar(mean(ys));

  const optimizer = tf.train.adam(0.01);

  MF = { userIndex, itemIndex, userEmb, itemEmb, userBias, itemBias, globalBias, trained:false, lossHistory:[] };

  // training loop
  const numExamples = uIdxs.length;
  const stepsPerEpoch = Math.max(1, Math.floor(numExamples / batchSize));
  // prepare loss chart
  const ctx = $('mf-loss').getContext('2d');
  let lossChart = new Chart(ctx, { type:'line', data:{ labels: [], datasets:[{label:'MF Loss', data:[], borderColor:'#e60073', fill:false}]}, options:{responsive:true} });

  for(let epoch=0; epoch<epochs; epoch++){
    let epochLoss = 0;
    for(let s=0; s<stepsPerEpoch; s++){
      const start = s*batchSize; const end = Math.min(numExamples, start + batchSize);
      const batchU = uIdxs.slice(start,end); const batchI = iIdxs.slice(start,end); const batchY = ys.slice(start,end);
      const uTensor = tf.tensor1d(batchU,'int32');
      const iTensor = tf.tensor1d(batchI,'int32');
      const yTensor = tf.tensor1d(batchY,'float32');

      const lossTensor = optimizer.minimize(() => {
        const uE = tf.gather(userEmb, uTensor);
        const iE = tf.gather(itemEmb, iTensor);
        const preds = tf.sum(tf.mul(uE, iE),1).add(tf.gather(userBias, uTensor)).add(tf.gather(itemBias, iTensor)).add(globalBias);
        const loss = tf.losses.meanSquaredError(yTensor, preds);
        return loss;
      }, true);

      const lossVal = (await lossTensor.data())[0];
      epochLoss += lossVal;
      tf.dispose([uTensor, iTensor, yTensor, lossTensor]);
    }
    const avgLoss = epochLoss / stepsPerEpoch;
    MF.lossHistory.push(avgLoss);
    lossChart.data.labels.push(`e${epoch+1}`);
    lossChart.data.datasets[0].data.push(avgLoss);
    lossChart.update();
    $('mf-status').innerText = `MF epoch ${epoch+1}/${epochs} — loss ${avgLoss.toFixed(4)}`;
    await tf.nextFrame();
  }

  MF.trained = true;
  $('mf-status').innerText = `Model training completed successfully!`;
  $('mf-predict').disabled = false;
}

// predict with MF
function mfPredict(){
  if(!MF.trained){ alert('Train MF first'); return; }
  const uid = $('mf-user').value; const iid = $('mf-item').value;
  if(!uid || !iid){ alert('Select user & item'); return; }
  const ui = MF.userIndex.get(uid); const ii = MF.itemIndex.get(iid);
  if(ui===undefined || ii===undefined){ alert('User or item not in training data'); return; }
  tf.tidy(()=>{
    const uE = tf.gather(MF.userEmb, tf.tensor1d([ui],'int32'));
    const iE = tf.gather(MF.itemEmb, tf.tensor1d([ii],'int32'));
    const pred = tf.sum(tf.mul(uE,iE),1).add(tf.gather(MF.userBias, tf.tensor1d([ui],'int32'))).add(tf.gather(MF.itemBias, tf.tensor1d([ii],'int32'))).add(MF.globalBias);
    const val = pred.dataSync()[0];
    $('mf-pred-note').innerText = `Predicted rating for User ${uid} on "${iid}" : ${val.toFixed(2)} / 5`;
  });
}

// ========== TWO-TOWER (simple in-browser) ==========

let TT = { trained:false, userEmb:null, itemEmb:null, usersList:[], itemsList:[], uIndex: null, iIndex:null };

// trainTwoTower with BPR-style loss (in-batch negatives)
async function trainTwoTower({epochs=8, emb=32, batch=512, sampleLimit=30000} = {}){
  $('tt-status').innerText = 'Preparing Two-Tower data...';
  const usersList = uniq(interactions.map(r=>r.user_id));
  const itemsList = uniq(items.map(i=>i.item_id));
  const uIndex = new Map(usersList.map((u,i)=>[u,i]));
  const iIndex = new Map(itemsList.map((it,j)=>[it,j]));

  // create training pairs (u, pos)
  const pairs = interactions.map(r=>({u:uIndex.get(r.user_id), i:iIndex.get(r.item_id)})).filter(p=>p.u!=null && p.i!=null);
  const samplePairs = pairs.slice(0, Math.min(sampleLimit, pairs.length));
  const numU = usersList.length, numI = itemsList.length;
  const k = Math.min(emb, 64);

  // variables
  const userEmb = tf.variable(tf.randomNormal([numU,k],0,0.1));
  const itemEmb = tf.variable(tf.randomNormal([numI,k],0,0.1));
  // small MLP weights
  const W_u = tf.variable(tf.randomNormal([k, k], 0, 0.1));
  const b_u = tf.variable(tf.zeros([k]));
  const W_i = tf.variable(tf.randomNormal([k, k], 0, 0.1));
  const b_i = tf.variable(tf.zeros([k]));

  const optimizer = tf.train.adam(0.005);
  TT = { userEmb, itemEmb, W_u, b_u, W_i, b_i, usersList, itemsList, uIndex, iIndex, trained:false, lossHistory:[] };

  // prepare loss chart
  const ctx = $('tt-loss').getContext('2d');
  let lossChart = new Chart(ctx, { type:'line', data:{ labels:[], datasets:[{label:'Two-Tower Loss', data:[], borderColor:'#e60073', fill:false}]}, options:{responsive:true} });

  // training loop with in-batch negatives (sample negative item per positive)
  const n = samplePairs.length;
  const steps = Math.max(1, Math.floor(n / batch));
  for(let epoch=0; epoch<epochs; epoch++){
    let epochLoss = 0;
    for(let s=0; s<steps; s++){
      const start = s*batch, end = Math.min(n, start+batch);
      const batch = samplePairs.slice(start,end);
      const uIdxs = batch.map(x=>x.u);
      const posIdxs = batch.map(x=>x.i);
      // sample negatives randomly
      const negIdxs = batch.map(()=> Math.floor(Math.random()*numI));
      const uTensor = tf.tensor1d(uIdxs,'int32');
      const posTensor = tf.tensor1d(posIdxs,'int32');
      const negTensor = tf.tensor1d(negIdxs,'int32');

      const lossT = optimizer.minimize(()=> {
        // gather embeddings
        const uE = tf.gather(userEmb, uTensor); // [B,k]
        const posE = tf.gather(itemEmb, posTensor);
        const negE = tf.gather(itemEmb, negTensor);
        // apply small MLP (linear + relu)
        const uH = tf.relu(tf.add(tf.matMul(uE, W_u), b_u)); // [B,k]
        const posH = tf.relu(tf.add(tf.matMul(posE, W_i), b_i));
        const negH = tf.relu(tf.add(tf.matMul(negE, W_i), b_i));
        const posScore = tf.sum(tf.mul(uH, posH),1); // [B]
        const negScore = tf.sum(tf.mul(uH, negH),1);
        // BPR loss: -log(sigmoid(pos-neg))
        const diff = tf.sub(posScore, negScore);
        const loss = tf.neg(tf.mean(tf.log(tf.sigmoid(diff).add(1e-7))));
        return loss;
      }, true);

      const lval = (await lossT.data())[0];
      epochLoss += lval;
      tf.dispose([uTensor,posTensor,negTensor,lossT]);
    }
    const avgLoss = epochLoss / steps;
    TT.lossHistory.push(avgLoss);
    lossChart.data.labels.push(`e${epoch+1}`);
    lossChart.data.datasets[0].data.push(avgLoss);
    lossChart.update();
    $('tt-status').innerText = `Two-Tower epoch ${epoch+1}/${epochs} — loss ${avgLoss.toFixed(4)}`;
    await tf.nextFrame();
  }

  TT.trained = true;
  $('tt-status').innerText = 'Two-Tower training completed successfully!';
  // render small embedding projection
  renderTTEmbeddingProjection();
}

// projection: take small sample of itemEmb, use SVD via tf.svd
function renderTTEmbeddingProjection(sampleSize=400){
  if(!TT.trained) return;
  const count = Math.min(sampleSize, TT.itemsList.length);
  const idxs = Array.from({length:count}, (_,i)=>i);
  const t = tf.gather(TT.itemEmb, tf.tensor1d(idxs,'int32')); // [count,k]
  const {u, s, v} = tf.svd(t, true);
  const u2 = u.slice([0,0],[u.shape[0],2]);
  const s2 = s.slice([0],[2]);
  const coords = u2.mul(s2.reshape([1,2]));
  coords.array().then(arr=>{
    // draw scatter
    const box = $('tt-embed-proj'); box.innerHTML = '';
    const canvas = document.createElement('canvas'); canvas.width = box.clientWidth||700; canvas.height = 240; box.appendChild(canvas);
    const ctx = canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const xs = arr.map(a=>a[0]), ys = arr.map(a=>a[1]);
    const minx=Math.min(...xs), maxx=Math.max(...xs), miny=Math.min(...ys), maxy=Math.max(...ys);
    for(let i=0;i<arr.length;i++){
      const x = ((arr[i][0]-minx)/(maxx-minx||1))*(canvas.width-30)+15;
      const y = ((arr[i][1]-miny)/(maxy-miny||1))*(canvas.height-30)+15;
      ctx.beginPath(); ctx.arc(x,y,3,0,2*Math.PI); ctx.fillStyle='#e60073'; ctx.fill();
    }
  }).catch(err=>console.warn(err)).finally(()=> t.dispose());
}

// two-tower test: pick random user with >=20 ratings
function twoTowerTest(){
  // build map counts
  const counts = {};
  interactions.forEach(r=> counts[r.user_id] = (counts[r.user_id]||0)+1);
  const candidates = Object.keys(counts).filter(u=>counts[u]>=20);
  if(candidates.length===0){ alert('No user with >=20 interactions'); return; }
  const userId = candidates[Math.floor(Math.random()*candidates.length)];
  // left: user's historical top-10
  const hist = (userToItems.get(userId) || []).sort((a,b)=> (b.rating - a.rating) || 0).slice(0,10);
  const left = $('tt-left').querySelector('tbody'); left.innerHTML = '';
  hist.forEach((h,i)=> left.appendChild(trRow(i+1, h.item_id, (h.rating||0).toFixed(2), getYearForItem(h.item_id))));
  // middle: basic top10 by avg rating
  const mid = $('tt-mid').querySelector('tbody'); mid.innerHTML = '';
  const arr = items.map(it=> ({ id: it.item_id, name: it.name, score: avgRatingMap.get(it.item_id)||0, year:getYearForItem(it.item_id)})).sort((a,b)=>b.score-a.score).slice(0,10);
  arr.forEach((r,i)=> mid.appendChild(trRow(i+1, r.id, r.score.toFixed(2), r.year)));
  // right: if two-tower trained compute user vector and recommend
  const right = $('tt-right').querySelector('tbody'); right.innerHTML = '';
  if(TT.trained){
    // compute user vector as mean of item embeddings for items the user rated
    const histItems = (userToItems.get(userId) || []).map(h=> TT.itemsList.indexOf(h.item_id)).filter(x=>x>=0);
    if(histItems.length===0){ right.innerHTML = `<tr><td colspan="4">No history in TT index for user</td></tr>`; }
    else {
      const t = tf.gather(TT.itemEmb, tf.tensor1d(histItems,'int32'));
      const uvec = t.mean(0).arraySync(); t.dispose();
      // compute cosine vs all TT.itemEmb (small sample for speed)
      const scores = [];
      for(let i=0;i<TT.itemsList.length;i++){
        const emb = TT.itemEmb.gather([i]).arraySync()[0];
        const s = cosineVec(uvec, emb);
        const it = items.find(x=>x.item_id===TT.itemsList[i]);
        scores.push({id: TT.itemsList[i], score: s, year: getYearForItem(TT.itemsList[i])});
      }
      scores.sort((a,b)=>b.score-a.score);
      scores.slice(0,10).forEach((r,i)=> right.appendChild(trRow(i+1, r.id, r.score.toFixed(3), r.year)));
    }
  } else {
    right.innerHTML = `<tr><td colspan="4">Two-Tower model not trained yet.</td></tr>`;
  }
  $('tt-test-results').classList.remove('hidden');
  $('tt-status').innerText = `Test run for user ${userId}`;
}
function trRow(rank, id, score, year){ const tr = document.createElement('tr'); const it = items.find(x=>x.item_id===id); tr.innerHTML = `<td>${rank}</td><td>${escapeHtml(id)}</td><td>${escapeHtml(it?it.name:id)}</td><td>${score}</td><td>${year||''}</td>`; return tr; }
function cosineVec(a,b){ let dot=0,na=0,nb=0; const n=Math.min(a.length,b.length); for(let i=0;i<n;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; } return (na&&nb)? dot/(Math.sqrt(na)*Math.sqrt(nb)) : 0; }
function getYearForItem(itemId){ const it = items.find(x=>x.item_id===itemId); if(!it) return ''; const m = (it.name||'').match(/(19|20)\d{2}/); return m? m[0] : ''; }

// ========== TOP-N recommendations (global) ==========
function computeTopN(){
  if(items.length===0){ alert('No items loaded'); return; }
  // weights profile
  const profile = $('weight-profile').value;
  let wSim=0.5, wRat=0.4, wPrice=0.1;
  if(profile==='rating'){ wSim=0.2; wRat=0.7; wPrice=0.1; }
  if(profile==='similarity'){ wSim=0.7; wRat=0.2; wPrice=0.1; }

  // similarity: if item embeddings present, compute similarity to "popular vector" or skip; we will compute item-to-item similarity to average item vector
  let useEmb = embeddingsObj && embeddingsObj.item_embeddings && Object.keys(embeddingsObj.item_embeddings).length>0;
  // compute item similarity measure: for each item compute its mean cosine to top popular items or just use embedding norm as proxy
  const simMap = new Map();
  if(useEmb){
    // compute average embedding across all items present in embeddings
    const keys = Object.keys(embeddingsObj.item_embeddings);
    if(keys.length>0){
      const k0 = embeddingsObj.item_embeddings[keys[0]].length;
      const avg = new Array(k0).fill(0);
      let count = 0;
      keys.forEach(kid => { const v = embeddingsObj.item_embeddings[kid]; if(v && v.length===k0){ for(let i=0;i<k0;i++) avg[i]+=v[i]; count++; }});
      if(count>0){ for(let i=0;i<k0;i++) avg[i]/=count; }
      items.forEach(it=>{
        const v = embeddingsObj.item_embeddings[it.item_id];
        const sim = v ? cosineVec(avg, v) : 0;
        simMap.set(it.item_id, sim);
      });
    } else {
      items.forEach(it=> simMap.set(it.item_id, 0));
    }
  } else {
    // fallback: co-purchase Jaccard similarity to global popular set: use item popularity as sim proxy
    const popularity = items.map(it=> [it.item_id, (itemToUsers.get(it.item_id)||new Set()).size] );
    const maxpop = Math.max(...popularity.map(p=>p[1]),1);
    popularity.forEach(p=> simMap.set(p[0], p[1]/maxpop));
  }

  // compute normalized sim and rating and inverse price
  const sims = items.map(it=> simMap.get(it.item_id) || 0);
  const simNorm = normalizeArr(sims);
  const ratings = items.map(it=> avgRatingMap.get(it.item_id) || 0);
  const ratNorm = normalizeArr(ratings);
  const prices = items.map(it=> it.price || 0);
  const maxP = Math.max(...prices,1);
  const priceInv = prices.map(p => 1 - (p/maxP)); // cheaper -> higher
  const pNorm = normalizeArr(priceInv);

  // assemble scored list
  const scored = items.map((it,i)=>{
    const sSim = simNorm[i] || 0;
    const sRat = ratNorm[i] || 0;
    const sP = pNorm[i] || 0;
    const score = wSim * sSim + wRat * sRat + wPrice * sP;
    const avgR = ratings[i] || 0;
    return { id: it.item_id, name: it.name, price: it.price || 0, rating: avgR, score };
  }).sort((a,b)=>b.score - a.score).slice(0,10);

  // render table
  const tbody = $('topn-table').querySelector('tbody'); tbody.innerHTML = '';
  scored.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}</td><td>${(r.rating||0).toFixed(2)}</td><td>${formatMoney(r.price)}</td><td>${r.score.toFixed(4)}</td>`;
    tbody.appendChild(tr);
  });
  $('note-topn').innerText = 'Top-10 computed (global).';
}

// normalize array to [0,1]
function normalizeArr(arr){
  if(!arr || arr.length===0) return [];
  const mn = Math.min(...arr), mx = Math.max(...arr);
  if(mx===mn) return arr.map(_=>0);
  return arr.map(v => (v - mn) / (mx - mn));
}

// ========== EDA: global scatter of price vs avg rating ==========
let edaChart = null;
function drawEDA(){
  if(items.length===0) return;
  const pts = items.map(it=> ({ x: it.price || 0, y: avgRatingMap.get(it.item_id) || 0, id: it.item_id, name: it.name }));
  const ctx = $('eda-scatter').getContext('2d');
  if(edaChart) edaChart.destroy();
  edaChart = new Chart(ctx, {
    type:'scatter',
    data: { datasets: [{ label: 'Price vs Avg Rating (items)', data: pts.map(p=>({x:p.x,y:p.y})), backgroundColor:'#ff66b2' }] },
    options: {
      responsive:true,
      plugins:{ tooltip: { callbacks: { label: (c)=> {
        const p = pts[c.dataIndex];
        return `${p.id} — ${p.name} : $${p.x} / ${p.y.toFixed(2)}`;
      } } } },
      scales: { x:{ title:{ display:true, text:'Price ($)'} }, y:{ title:{ display:true, text:'Avg Rating'} } },
      onClick: (evt, elems) => {
        if(!elems.length) return;
        const idx = elems[0].index;
        const id = pts[idx].id;
        // set item selection and auto-run content-based
        $('select-item').value = id;
        doContentBased();
      }
    }
  });
  $('eda-note').innerText = `${items.length} items shown. Click a point to jump to that item.`;
}

// helper: populate data on load if present
window.addEventListener('load', ()=>{
  setTimeout(()=>{ // small delay to allow auto-load attempt
    refreshDataFromAPI();
  }, 600);
});
