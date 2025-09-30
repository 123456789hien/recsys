// app.js
// Complete front-end app controlling data load, training baseline & deep models, test, visualizations.
// Expects /data/u.data and /data/u.item to exist (relative paths).
// Uses TwoTowerModel from two-tower.js and TensorFlow.js.
//
// Key features:
// - Loads MovieLens 100K (limited by maxInteractions)
// - Trains Baseline (embeddings-only) then Deep model (embeddings + dense layers)
// - Shows live loss plot (current model) and comparison chart (both losses per epoch)
// - Projects item embeddings (PCA via power iteration) and draws scatter with hover tooltip
// - Test: pick random user with >=20 ratings and show historical Top-10 vs model Top-10 (exclude rated items)

(() => {
  // ---------- Config ----------
  const CONFIG = {
    maxInteractions: 80000,
    embeddingDim: 32,
    epochs: 6,
    batchSize: 256,
    learningRate: 0.01,
    sampleForProjection: 800,
    minRatingsForTestUser: 20,
    dropoutRate: 0.2
  };

  // ---------- DOM ----------
  const btnLoad = document.getElementById('btnLoad');
  const btnTrain = document.getElementById('btnTrain');
  const btnTest = document.getElementById('btnTest');
  const btnStop = document.getElementById('btnStop');
  const useBPR = document.getElementById('useBPR');
  const statustext = document.getElementById('statustext');
  const lossCanvas = document.getElementById('lossCanvas');
  const compCanvas = document.getElementById('compCanvas');
  const projCanvas = document.getElementById('projCanvas');
  const resultsDiv = document.getElementById('results');
  const tooltip = document.getElementById('tooltip');

  // ---------- State ----------
  let interactions = []; // {userIdRaw, itemIdRaw, rating, ts, userIdx, itemIdx}
  let itemsMap = new Map(); // rawItemId -> {title, year}
  let userToRated = new Map(); // rawUserId -> [{itemIdRaw,rating,ts}]
  let userIndex = new Map(), itemIndex = new Map(), revUser = [], revItem = [];
  let numUsers = 0, numItems = 0;
  let baselineModel = null, deepModel = null;
  let trainingFlag = false;
  let lossHistory = { baseline: [], deep: [] }; // array of epoch avg losses

  // ---------- Small utilities ----------
  function setStatus(s){ statustext.textContent = s; console.log(s); }
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  function escapeHtml(s){ return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] } }

  // ---------- Simple canvas plot helpers ----------
  const LossPlot = (function(){
    const c = lossCanvas; const ctx = c.getContext('2d');
    let points = [];
    function clear(){ points=[]; ctx.clearRect(0,0,c.width,c.height); drawGrid(); }
    function drawGrid(){
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
      ctx.strokeStyle='rgba(255,95,168,0.08)';
      for(let x=40;x<c.width-10;x+=40){ ctx.beginPath(); ctx.moveTo(x,8); ctx.lineTo(x,c.height-30); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(40,8); ctx.lineTo(40,c.height-30); ctx.lineTo(c.width-10,c.height-30); ctx.strokeStyle='rgba(180,80,120,0.08)'; ctx.stroke();
      ctx.fillStyle='#b03b6e'; ctx.font='12px Inter, sans-serif'; ctx.fillText('Live Loss', 12, 18);
    }
    function add(v){
      points.push(v); render();
    }
    function render(){
      drawGrid();
      if(points.length===0) return;
      const w=c.width-60, h=c.height-50;
      const max=Math.max(...points), min=Math.min(...points);
      ctx.strokeStyle='#ff8fb1'; ctx.lineWidth=1.6; ctx.beginPath();
      points.forEach((p,i)=>{
        const x = 40 + (i/(points.length-1||1))*w;
        const y = 10 + (1 - (p-min)/((max-min)||1))*h;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }
    drawGrid();
    return { clear, add };
  })();

  const CompPlot = (function(){
    const c = compCanvas; const ctx = c.getContext('2d');
    function clear(){ ctx.clearRect(0,0,c.width,c.height); drawAxes(); }
    function drawAxes(){
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle='#b03b6e'; ctx.font='12px Inter, sans-serif'; ctx.fillText('Baseline vs Deep — epoch loss', 10, 16);
      ctx.strokeStyle='rgba(255,95,168,0.08)'; ctx.beginPath(); ctx.moveTo(40,8); ctx.lineTo(40,c.height-30); ctx.lineTo(c.width-10,c.height-30); ctx.stroke();
    }
    function draw(baselineArr, deepArr){
      drawAxes();
      const maxY = Math.max(...baselineArr.concat(deepArr, [0.0001]));
      const minY = Math.min(...baselineArr.concat(deepArr, [0]));
      const n = Math.max(baselineArr.length, deepArr.length);
      const w=c.width-60, h=c.height-50;
      function plot(arr, color){
        ctx.strokeStyle = color; ctx.lineWidth=2; ctx.beginPath();
        for(let i=0;i<arr.length;i++){
          const x = 40 + (i/(n-1||1))*w;
          const y = 10 + (1 - (arr[i]-minY)/((maxY-minY)||1))*h;
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
      if(baselineArr.length) plot(baselineArr, '#ffd1e3'); // pale pink
      if(deepArr.length) plot(deepArr, '#ff5fa8'); // strong pink
      // legend
      ctx.fillStyle='#8a6b74'; ctx.font='12px Inter, sans-serif';
      ctx.fillText('Baseline', c.width-140, 18); ctx.fillStyle='#ffd1e3'; ctx.fillRect(c.width-190,10,12,8);
      ctx.fillStyle='#8a6b74'; ctx.fillText('Deep', c.width-70, 18); ctx.fillStyle='#ff5fa8'; ctx.fillRect(c.width-95,10,12,8);
    }
    drawAxes();
    return { clear, draw };
  })();

  // Projection canvas interaction
  const Projection = (function(){
    const c = projCanvas; const ctx = c.getContext('2d'); let points=[];
    function clear(){ ctx.clearRect(0,0,c.width,c.height); points=[]; }
    function draw(ptArray){
      points = ptArray;
      ctx.clearRect(0,0,c.width,c.height);
      const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const pad = 20;
      points.forEach(p=>{
        const px = pad + ((p.x - minX)/((maxX-minX)||1))*(c.width - pad*2);
        const py = pad + (1 - (p.y - minY)/((maxY-minY)||1))*(c.height - pad*2);
        p._sx = px; p._sy = py;
        ctx.beginPath(); ctx.fillStyle='#ff5fa8'; ctx.arc(px,py,3.5,0,Math.PI*2); ctx.fill();
      });
    }
    function handleMove(evt){
      const r = c.getBoundingClientRect();
      const mx = evt.clientX - r.left, my = evt.clientY - r.top;
      let nearest=null, best=Infinity;
      for(const p of points){
        const d = (p._sx - mx)**2 + (p._sy - my)**2;
        if(d < best){ best = d; nearest = p; }
      }
      if(nearest && best < 12*12){
        tooltip.style.left = (nearest._sx + r.left + 12) + 'px';
        tooltip.style.top = (nearest._sy + r.top + 12) + 'px';
        tooltip.textContent = nearest.title;
        tooltip.style.display = 'block';
      } else { tooltip.style.display = 'none'; }
    }
    c.addEventListener('mousemove', handleMove);
    c.addEventListener('mouseleave', ()=> tooltip.style.display='none');
    return { clear, draw };
  })();

  // ---------- Data loading ----------
  async function loadData(){
    setStatus('Loading data files...');
    interactions = []; itemsMap.clear(); userToRated.clear(); userIndex.clear(); itemIndex.clear();
    try{
      const [uDataResp, uItemResp] = await Promise.all([fetch('data/u.data'), fetch('data/u.item')]);
      if(!uDataResp.ok || !uItemResp.ok) throw new Error('Missing data files under /data/. Place u.data and u.item there.');
      const [udText, uiText] = await Promise.all([uDataResp.text(), uItemResp.text()]);

      // parse u.item
      uiText.split('\n').forEach(line=>{
        if(!line.trim()) return;
        const parts = line.split('|');
        const id = parts[0];
        const titleRaw = parts[1] || '';
        let title = titleRaw, year = null;
        const m = titleRaw.match(/\((\d{4})\)$/);
        if(m){ year = +m[1]; title = titleRaw.replace(/\s*\(\d{4}\)$/, '').trim(); }
        itemsMap.set(id, { title, year });
      });

      // parse u.data (tab separated)
      const lines = udText.split('\n').filter(l=>l.trim());
      const limit = Math.min(lines.length, CONFIG.maxInteractions);
      for(let i=0;i<limit;i++){
        const parts = lines[i].split('\t');
        if(parts.length < 4) continue;
        const userIdRaw = parts[0], itemIdRaw = parts[1], rating = Number(parts[2]), ts = Number(parts[3]);
        interactions.push({ userIdRaw, itemIdRaw, rating, ts });
        if(!userToRated.has(userIdRaw)) userToRated.set(userIdRaw, []);
        userToRated.get(userIdRaw).push({ itemIdRaw, rating, ts });
      }

      // build indexers (only users/items present in interactions)
      const users = Array.from(new Set(interactions.map(i=>i.userIdRaw))).sort();
      const items = Array.from(new Set(interactions.map(i=>i.itemIdRaw))).sort();
      users.forEach((u,i)=>{ userIndex.set(u,i); revUser[i]=u; });
      items.forEach((it,i)=>{ itemIndex.set(it,i); revItem[i]=it; });
      numUsers = revUser.length; numItems = revItem.length;

      interactions.forEach(it => { it.userIdx = userIndex.get(it.userIdRaw); it.itemIdx = itemIndex.get(it.itemIdRaw); });
      // sort each user's rated list (rating desc, ts desc)
      for(const [u,lst] of userToRated.entries()) lst.sort((a,b)=> (b.rating - a.rating) || (b.ts - a.ts));

      setStatus(`Loaded ${interactions.length} interactions, ${numUsers} users, ${numItems} items.`);
      btnTrain.disabled = false; btnTest.disabled = false;
      LossPlot.clear(); CompPlot.clear(); Projection.clear(); resultsDiv.innerHTML = '<div style="color:var(--muted)">Ready to train.</div>';
    } catch(err){
      console.error(err);
      setStatus('Error loading data: ' + (err.message || err));
    }
  }

  // ---------- Model creation ----------
  function initModels(){
    // Dispose existing
    try{ if(baselineModel) baselineModel.dispose(); if(deepModel) deepModel.dispose(); } catch(e){}
    baselineModel = new TwoTowerModel(numUsers, numItems, CONFIG.embeddingDim, { deep:false });
    deepModel = new TwoTowerModel(numUsers, numItems, CONFIG.embeddingDim, { deep:true, dropout: CONFIG.dropoutRate });
  }

  // ---------- Batching ----------
  function* batchGen(arr, batchSize, epochs){
    for(let e=0;e<epochs;e++){
      const copy = arr.slice(); shuffle(copy);
      for(let i=0;i<copy.length;i+=batchSize){
        const b = copy.slice(i, i+batchSize);
        yield { epoch:e, batch: b };
      }
    }
  }

  // ---------- Training loop for one model ----------
  async function trainOneModel(model, label, opts){
    const optimizer = tf.train.adam(opts.learningRate);
    const useBpr = useBPR.checked;
    const totalBatches = Math.ceil(interactions.length / opts.batchSize) * opts.epochs;
    let batchCount = 0;
    let epochLosses = []; // accumulate per-epoch average
    LossPlot.clear();
    setStatus(`Training ${label} model...`);

    for(const { epoch, batch } of batchGen(interactions, opts.batchSize, opts.epochs)){
      if(!trainingFlag) break;
      // prepare tensors
      const users = tf.tensor1d(batch.map(x=>x.userIdx), 'int32');
      const items = tf.tensor1d(batch.map(x=>x.itemIdx), 'int32');
      // training step
      const lossVal = await optimizer.minimize(()=> tf.tidy(()=>{
        const uEmb = model.userForward(users); // [B, d]
        const iEmb = model.itemForward(items); // [B, d]
        if(!useBpr){
          // in-batch softmax: logits = U @ I^T  -> [B, B], labels diagonal
          const logits = tf.matMul(uEmb, iEmb, false, true); // [B,B]
          const logp = tf.logSoftmax(logits);
          const diag = tf.tensor1d(Array.from({length:batch.length}, (_,i)=>i), 'int32');
          // gather diagonal entries using one-hot trick
          const diagVals = tf.gatherND(logp, tf.stack([tf.range(0,batch.length,'int32'), diag],1));
          const loss = tf.neg(tf.mean(diagVals));
          return loss;
        } else {
          // BPR-like: negative is circular shift
          const neg = tf.concat([iEmb.slice([1,0],[batch.length-1,-1]), iEmb.slice([0,0],[1,-1])], 0);
          const posS = tf.sum(tf.mul(uEmb, iEmb), 1); const negS = tf.sum(tf.mul(uEmb, neg), 1);
          const x = tf.sub(posS, negS);
          const loss = tf.mean(tf.neg(tf.logSigmoid(x)));
          return loss;
        }
      }), true, [model.userEmbedding, model.itemEmbedding, ...(model.deep ? model.denseVars : [])]);

      const val = lossVal.dataSync()[0];
      lossVal.dispose();
      users.dispose(); items.dispose();

      batchCount++;
      LossPlot.add(val);
      // accumulate per-epoch (simple running average)
      const eidx = epoch;
      if(!epochLosses[eidx]) epochLosses[eidx] = { sum:0, n:0 };
      epochLosses[eidx].sum += val; epochLosses[eidx].n += 1;

      setStatus(`${label} — epoch ${epoch+1}/${opts.epochs}, batch ${batchCount}/${totalBatches}, loss ${val.toFixed(4)}`);
      // allow UI to update
      await sleep(6);
    }

    // compute epoch averages
    const epochAverages = epochLosses.map(x => x ? x.sum / x.n : NaN);
    setStatus(`${label} training finished.`);
    return epochAverages;
  }

  // ---------- Full training: baseline then deep, update comparison chart ----------
  async function trainBoth(){
    if(!interactions.length) { setStatus('Load data first.'); return; }
    btnTrain.disabled=true; btnLoad.disabled=true; btnTest.disabled=true; btnStop.disabled=false;
    trainingFlag = true;
    lossHistory = { baseline: [], deep: [] };
    initModels();

    // train baseline (embedding-only)
    const baselineEpochLoss = await trainOneModel(baselineModel, 'Baseline', { learningRate: CONFIG.learningRate, batchSize: CONFIG.batchSize, epochs: CONFIG.epochs });
    lossHistory.baseline = baselineEpochLoss;
    CompPlot.draw(lossHistory.baseline, lossHistory.deep);

    if(!trainingFlag){ setStatus('Training stopped by user.'); finalizeAfterTraining(); return; }

    // train deep model
    const deepEpochLoss = await trainOneModel(deepModel, 'Deep', { learningRate: CONFIG.learningRate, batchSize: CONFIG.batchSize, epochs: CONFIG.epochs });
    lossHistory.deep = deepEpochLoss;
    CompPlot.draw(lossHistory.baseline, lossHistory.deep);

    // final projection from deep model
    await drawProjection(CONFIG.sampleForProjection);

    finalizeAfterTraining();
  }

  function finalizeAfterTraining(){
    trainingFlag = false;
    btnTrain.disabled = false; btnLoad.disabled = false; btnTest.disabled = false; btnStop.disabled = true;
    setStatus('Training complete. You can Test now.');
  }

  // ---------- Draw projection (PCA using covariance + power iteration) ----------
  async function drawProjection(sampleN){
    if(!deepModel) return;
    setStatus('Preparing embedding projection (Deep model)...');
    Projection.clear();
    // sample item indices
    const total = numItems;
    const sampleIndices = [];
    if(total <= sampleN){
      for(let i=0;i<total;i++) sampleIndices.push(i);
    } else {
      const arr = Array.from({length: total}, (_,i)=>i); shuffle(arr); sampleIndices.push(...arr.slice(0, sampleN));
    }
    // fetch embeddings in batches to avoid memory spike
    const idxT = tf.tensor1d(sampleIndices, 'int32');
    const embT = deepModel.itemForward(idxT); // [n, d]
    const emb = await embT.array();
    idxT.dispose(); embT.dispose();

    // center
    const n = emb.length, d = emb[0].length;
    const mean = new Array(d).fill(0);
    for(const r of emb) for(let j=0;j<d;j++) mean[j]+=r[j];
    for(let j=0;j<d;j++) mean[j]/=n;
    const X = emb.map(r => r.map((v,j)=> v - mean[j]));

    // covariance C = X^T X
    const C = Array.from({length:d}, ()=>new Array(d).fill(0));
    for(let i=0;i<n;i++){
      for(let a=0;a<d;a++){
        for(let b=0;b<d;b++) C[a][b] += X[i][a]*X[i][b];
      }
    }

    function powerIter(M, iters=100){
      const m = M.length;
      let v = new Array(m).fill(0).map(()=>Math.random()-0.5);
      let norm = Math.hypot(...v) || 1;
      v = v.map(x=>x/norm);
      for(let k=0;k<iters;k++){
        const w = new Array(m).fill(0);
        for(let i=0;i<m;i++) for(let j=0;j<m;j++) w[i] += M[i][j]*v[j];
        const nrm = Math.hypot(...w) || 1;
        v = w.map(x=>x/nrm);
      }
      // eigenvalue
      const w2 = new Array(m).fill(0);
      for(let i=0;i<m;i++) for(let j=0;j<m;j++) w2[i] += M[i][j]*v[j];
      let lambda=0; for(let i=0;i<m;i++) lambda += v[i]*w2[i];
      return {vec:v, val:lambda};
    }

    const e1 = powerIter(C, 160);
    // deflate
    const C2 = Array.from({length:d}, (_,i)=> Array.from({length:d}, (_,j)=> C[i][j] - e1.val * e1.vec[i]*e1.vec[j]));
    const e2 = powerIter(C2, 160);

    const pc1 = e1.vec, pc2 = e2.vec;
    const points = X.map((row, idx)=> {
      const x = row.reduce((s,v,i)=> s + v*pc1[i], 0);
      const y = row.reduce((s,v,i)=> s + v*pc2[i], 0);
      const raw = revItem[sampleIndices[idx]];
      const title = itemsMap.get(raw)?.title || ('#'+raw);
      return { x, y, title };
    });

    Projection.draw(points);
    setStatus('Projection ready (hover points).');
  }

  // ---------- Test: pick random user with >= min ratings ----------
  async function testOnce(){
    if(!deepModel){ setStatus('Train models first.'); return; }
    const candidates = Array.from(userToRated.entries()).filter(([u,l]) => l.length >= CONFIG.minRatingsForTestUser);
    if(candidates.length===0){ setStatus('No user with enough ratings found.'); return; }
    const [userRaw, ratedList] = candidates[Math.floor(Math.random()*candidates.length)];
    const userIdx = userIndex.get(userRaw);
    const leftTop = ratedList.slice(0,10).map(r => ({ title: itemsMap.get(r.itemIdRaw)?.title || r.itemIdRaw, rating: r.rating }));

    setStatus('Computing recommendations for user ' + userRaw + ' ...');

    // compute user embedding from deep model (as demonstration)
    const uEmb = deepModel.getUserEmbeddingTensor(userIdx); // [1,d]
    // compute scores in chunks
    const CHUNK = 2048;
    let scores = new Array(numItems).fill(-Infinity);
    for(let i=0;i<numItems;i+=CHUNK){
      const size = Math.min(CHUNK, numItems - i);
      const idxs = Array.from({length:size}, (_,k)=>i+k);
      const idxT = tf.tensor1d(idxs, 'int32');
      const itemEmb = deepModel.itemForward(idxT); // [size,d]
      const logits = tf.matMul(uEmb, itemEmb, false, true); // [1,size]
      const arr = await logits.data();
      for(let k=0;k<size;k++) scores[i+k] = arr[k];
      idxT.dispose(); itemEmb.dispose(); logits.dispose();
    }
    uEmb.dispose();

    const ratedSet = new Set(ratedList.map(r=>r.itemIdRaw));
    const candidatesScores = [];
    for(let i=0;i<numItems;i++){
      const raw = revItem[i];
      if(ratedSet.has(raw)) continue;
      candidatesScores.push({ idx:i, score: scores[i] });
    }
    candidatesScores.sort((a,b)=>b.score - a.score);
    const rightTop = candidatesScores.slice(0,10).map(s => ({ title: itemsMap.get(revItem[s.idx])?.title || revItem[s.idx], score: s.score }));

    renderComparison(leftTop, rightTop, userRaw);
    setStatus('Test complete for user ' + userRaw + '.');
  }

  function renderComparison(left, right, userRaw){
    const html = [];
    html.push(`<h4 style="margin:4px 0 6px;color:#b03b6e">User ${escapeHtml(userRaw)}</h4>`);
    html.push('<table><tr><th>Top-10 Historically Rated</th><th>Top-10 Recommended (Deep)</th></tr>');
    for(let i=0;i<10;i++){
      const L = left[i] ? `${i+1}. ${escapeHtml(left[i].title)} <small>(${left[i].rating})</small>` : '';
      const R = right[i] ? `${i+1}. ${escapeHtml(right[i].title)} <small>score:${right[i].score.toFixed(3)}</small>` : '';
      html.push(`<tr><td>${L}</td><td>${R}</td></tr>`);
    }
    html.push('</table>');
    resultsDiv.innerHTML = html.join('');
  }

  // ---------- Wire UI ----------
  btnLoad.addEventListener('click', async ()=>{
    btnLoad.disabled=true; btnTrain.disabled=true; btnTest.disabled=true;
    await loadData();
    btnLoad.disabled=false;
  });

  btnTrain.addEventListener('click', async ()=>{
    if(!interactions.length){ setStatus('Load data first.'); return; }
    btnTrain.disabled=true; btnTest.disabled=true; btnLoad.disabled=true; btnStop.disabled=false;
    trainingFlag = true; lossHistory = { baseline: [], deep: [] };
    LossPlot.clear(); CompPlot.clear(); Projection.clear();
    await trainBoth();
  });

  btnStop.addEventListener('click', ()=>{
    trainingFlag = false;
    btnStop.disabled = true;
    setStatus('Asked to stop training — finishing current step...');
  });

  btnTest.addEventListener('click', async ()=>{ await testOnce(); });

  // ---------- Clean up on unload ----------
  window.addEventListener('beforeunload', ()=> {
    try{ if(baselineModel) baselineModel.dispose(); if(deepModel) deepModel.dispose(); } catch(e){}
  });

  // Expose for debugging
  window.__twoTowerApp = { loadData, trainBoth, testOnce };

})();
