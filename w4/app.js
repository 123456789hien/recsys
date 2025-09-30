// app.js
// Clean, complete app wiring for the Two-Tower demo.
// Matches the UI in index.html (IDs and layout).
// - load data from /data/u.data and /data/u.item
// - train two-tower (MLP towers) with in-batch softmax or BPR
// - test compares Top-10 Rated | Recommended (Deep) | Recommended (Baseline)

// ---------- Configuration ----------
const CONFIG = {
  embeddingDim: 32,
  epochs: 6,
  batchSize: 256,
  learningRate: 0.005,
  maxInteractions: 80000,
  projectionSample: 1000,
};

// ---------- State ----------
let interactions = [];
let items = new Map(); // rawId -> {title, year}
let userToRatings = new Map();
let userIndex = new Map();
let itemIndex = new Map();
let reverseUser = [];
let reverseItem = [];
let numUsers = 0, numItems = 0;
let popularity = new Map();

let model = null;
let optimizer = null;
let stopRequested = false;

// ---------- UI refs ----------
const btnLoad = document.getElementById('btnLoad');
const btnTrain = document.getElementById('btnTrain');
const btnTest = document.getElementById('btnTest');
const btnStop = document.getElementById('btnStop');
const useBPR = document.getElementById('useBPR');
const statustext = document.getElementById('statustext');
const lossCanvas = document.getElementById('lossCanvas');
const lossCtx = lossCanvas.getContext('2d');
const compCanvas = document.getElementById('compCanvas');
const compCtx = compCanvas.getContext('2d');
const projCanvas = document.getElementById('projCanvas');
const projCtx = projCanvas.getContext('2d');
const resultsDiv = document.getElementById('results');
const tooltip = document.getElementById('tooltip');

// ---------- Helpers ----------
function now() { return (new Date()).toLocaleTimeString(); }
function randChoice(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} fetch failed: ${r.status}`);
  return await r.text();
}

// ---------- Data loading ----------
async function loadData() {
  statustext.textContent = 'loading...';
  try {
    const [udataTxt, uitemTxt] = await Promise.all([fetchText('data/u.data'), fetchText('data/u.item')]);

    // parse items (u.item: id|title|...)
    items.clear();
    uitemTxt.split(/\r?\n/).forEach(line => {
      if (!line.trim()) return;
      const parts = line.split('|');
      const raw = parts[0];
      const title = (parts[1] || '').trim();
      let year = null;
      const m = title.match(/\((\d{4})\)/);
      if (m) year = Number(m[1]);
      items.set(raw, { title, year });
    });

    // parse interactions (u.data: user_id \t item_id \t rating \t ts)
    interactions = [];
    udataTxt.split(/\r?\n/).forEach(line => {
      if (!line.trim()) return;
      const p = line.split('\t');
      if (p.length < 4) return;
      interactions.push({ uIdRaw: p[0], iIdRaw: p[1], rating: Number(p[2]), ts: Number(p[3]) });
    });

    // keep most recent interactions up to cap
    interactions.sort((a,b) => b.ts - a.ts);
    if (interactions.length > CONFIG.maxInteractions) interactions = interactions.slice(0, CONFIG.maxInteractions);

    // build indices
    userIndex.clear(); itemIndex.clear(); reverseUser = []; reverseItem = [];
    let uc=0, ic=0;
    for (const it of interactions) {
      if (!userIndex.has(it.uIdRaw)) { userIndex.set(it.uIdRaw, uc++); reverseUser.push(it.uIdRaw); }
      if (!itemIndex.has(it.iIdRaw)) { itemIndex.set(it.iIdRaw, ic++); reverseItem.push(it.iIdRaw); }
    }
    numUsers = uc; numItems = ic;

    // attach indices and build per-user lists
    userToRatings.clear();
    for (const it of interactions) {
      it.uIdx = userIndex.get(it.uIdRaw);
      it.iIdx = itemIndex.get(it.iIdRaw);
      if (!userToRatings.has(it.uIdRaw)) userToRatings.set(it.uIdRaw, []);
      userToRatings.get(it.uIdRaw).push({ itemId: it.iIdRaw, rating: it.rating, ts: it.ts, iIdx: it.iIdx });
    }
    // sort user lists by rating desc then recency
    for (const [u, arr] of userToRatings.entries()) {
      arr.sort((a,b) => (b.rating - a.rating) || (b.ts - a.ts));
      userToRatings.set(u, arr);
    }

    // popularity baseline
    popularity = new Map();
    for (const it of interactions) {
      popularity.set(it.iIdx, (popularity.get(it.iIdx) || 0) + 1);
    }

    statustext.textContent = `loaded — users=${numUsers}, items=${numItems}, interactions=${interactions.length}`;
    btnTrain.disabled = false;
    btnTest.disabled = true;
  } catch (err) {
    console.error(err);
    statustext.textContent = `load error: ${err.message}`;
  }
}

// ---------- Simple loss plot ----------
const LossPlot = {
  pts: [],
  max: 2000,
  push(v) { this.pts.push(v); if (this.pts.length > this.max) this.pts.shift(); this.draw(); },
  clear() { this.pts = []; this.draw(); },
  draw() {
    const ctx = lossCtx;
    const w = lossCanvas.width, h = lossCanvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
    if (!this.pts.length) return;
    const maxv = Math.max(...this.pts), minv = Math.min(...this.pts);
    const range = Math.max(1e-6, maxv - minv);
    ctx.beginPath(); ctx.lineWidth = 2; ctx.strokeStyle = '#ff5fa8';
    this.pts.forEach((v,i) => {
      const x = (i/(this.pts.length-1))*w;
      const y = h - ((v - minv)/range)*(h-8) - 4;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.fillStyle = '#b03b6e'; ctx.font = '12px Inter, system-ui';
    ctx.fillText(`loss ${this.pts[this.pts.length-1].toFixed(4)}`, 8, 14);
  }
};

// ---------- Build model ----------
function buildModel() {
  model = new TwoTowerModel(numUsers, numItems, CONFIG.embeddingDim, { mlpHidden: [128, 64] });
  optimizer = tf.train.adam(CONFIG.learningRate);
  btnTest.disabled = false;
}

// ---------- Batching ----------
function makeBatches() {
  const arr = interactions.slice();
  for (let i = arr.length - 1; i > 0; --i) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const batches = [];
  for (let i=0;i<arr.length;i+=CONFIG.batchSize) batches.push(arr.slice(i, i+CONFIG.batchSize));
  return batches;
}

// ---------- Training loop ----------
async function trainLoop() {
  if (!model) buildModel();
  LossPlot.clear();
  stopRequested = false;
  btnStop.disabled = false; btnTrain.disabled = true; btnLoad.disabled = true; btnTest.disabled = true;
  statustext.textContent = `training started (${now()})`;

  const epochs = CONFIG.epochs;
  for (let ep=0; ep<epochs; ++ep) {
    const batches = makeBatches();
    for (let bi=0; bi<batches.length; ++bi) {
      if (stopRequested) {
        statustext.textContent = 'training stopped';
        btnStop.disabled = true; btnTrain.disabled = false; btnLoad.disabled = false; btnTest.disabled = false;
        return;
      }
      const batch = batches[bi];
      const N = batch.length;
      const uIdxArr = batch.map(x => x.uIdx);
      const iIdxArr = batch.map(x => x.iIdx);

      // optimizer.minimize with tidy to auto-dispose intermediates (but keep returned loss)
      const lossTensor = optimizer.minimize(() => tf.tidy(() => {
        const uT = tf.tensor1d(uIdxArr, 'int32');
        const iT = tf.tensor1d(iIdxArr, 'int32');
        const U = model.userForward(uT); // [N,D]
        const P = model.itemForward(iT); // [N,D]

        let loss;
        if (useBPR.checked) {
          // sample negatives uniformly
          const negArr = new Int32Array(N);
          for (let k=0;k<N;++k) negArr[k] = Math.floor(Math.random()*numItems);
          const nT = tf.tensor1d(Array.from(negArr), 'int32');
          const Nn = model.itemForward(nT);
          const posScore = tf.sum(tf.mul(U, P), 1); // [N]
          const negScore = tf.sum(tf.mul(U, Nn), 1); // [N]
          const diff = tf.sub(posScore, negScore);
          loss = tf.neg(tf.mean(tf.log(tf.sigmoid(diff).add(1e-8))));
          nT.dispose(); Nn.dispose(); posScore.dispose(); negScore.dispose(); diff.dispose();
        } else {
          // in-batch softmax cross-entropy: logits = U @ P^T -> labels = identity
          const logits = tf.matMul(U, P, false, true); // [N,N]
          const labels = tf.eye(N);
          // IMPORTANT: do NOT pass options object as third param to softmaxCrossEntropy (avoids 'weights' error)
          const perExLoss = tf.losses.softmaxCrossEntropy(labels, logits); // [N]
          loss = tf.mean(perExLoss);
          logits.dispose(); labels.dispose(); perExLoss.dispose();
        }
        uT.dispose(); iT.dispose(); U.dispose(); P.dispose();
        return loss;
      }), true);

      const lossVal = lossTensor.dataSync()[0];
      lossTensor.dispose();
      LossPlot.push(lossVal);

      if (bi % 5 === 0) {
        statustext.textContent = `epoch ${ep+1}/${epochs} batch ${bi+1}/${batches.length} loss=${lossVal.toFixed(4)} (${now()})`;
        await tf.nextFrame();
      }
    }
  }

  btnStop.disabled = true; btnTrain.disabled = false; btnLoad.disabled = false; btnTest.disabled = false;
  statustext.textContent = `training finished (${now()})`;

  await drawProjection();
}

// ---------- Stop button ----------
btnStop.addEventListener('click', () => { stopRequested = true; btnStop.disabled = true; });

// ---------- Projection (PCA via covariance + power iteration) ----------
let projectionPoints = [];
async function drawProjection() {
  statustext.textContent = 'computing projection...';
  const sampleSize = Math.min(CONFIG.projectionSample, numItems);
  if (sampleSize === 0) { statustext.textContent = 'no items to project'; return; }
  const all = [...Array(numItems).keys()];
  const sample = [];
  for (let i=0;i<sampleSize;++i) {
    const j = Math.floor(Math.random()*all.length);
    sample.push(all.splice(j,1)[0]);
  }

  const idxT = tf.tensor1d(sample, 'int32');
  const embT = model.itemForward(idxT); // [S, D]
  const embArr = await embT.array();
  idxT.dispose(); embT.dispose();

  const S = embArr.length;
  const D = embArr[0].length;
  // mean center
  const mean = new Array(D).fill(0);
  for (let i=0;i<S;++i) for (let d=0; d<D; ++d) mean[d] += embArr[i][d];
  for (let d=0; d<D; ++d) mean[d] /= S;
  const X = embArr.map(r => r.map((v,d)=> v - mean[d]));
  // covariance
  const C = Array.from({length:D}, () => new Array(D).fill(0));
  for (let i=0;i<S;++i) for (let a=0;a<D;++a) {
    const xa = X[i][a];
    for (let b=0;b<D;++b) C[a][b] += xa * X[i][b];
  }
  const denom = Math.max(1, S-1);
  for (let a=0;a<D;++a) for (let b=0;b<D;++b) C[a][b] /= denom;

  // power iteration
  function powerIter(mat, iters=200) {
    const n = mat.length;
    let v = new Array(n).fill(0).map(()=>Math.random()-0.5);
    let norm = Math.sqrt(v.reduce((s,x)=>s+x*x,0));
    v = v.map(x=>x/(norm||1));
    for (let it=0; it<iters; ++it) {
      const w = new Array(n).fill(0);
      for (let i=0;i<n;++i) for (let j=0;j<n;++j) w[i] += mat[i][j]*v[j];
      let nw = Math.sqrt(w.reduce((s,x)=>s+x*x,0));
      if (nw < 1e-12) break;
      v = w.map(x=>x/nw);
    }
    const w2 = new Array(n).fill(0);
    for (let i=0;i<n;++i) for (let j=0;j<n;++j) w2[i] += mat[i][j]*v[j];
    const lambda = v.reduce((s,x,i)=> s + x*w2[i], 0);
    return {vec: v, val: lambda};
  }

  const p1 = powerIter(C, 200);
  const v1 = p1.vec;
  // deflate
  const C2 = Array.from({length:D}, () => new Array(D).fill(0));
  for (let a=0;a<D;++a) for (let b=0;b<D;++b) C2[a][b] = C[a][b] - p1.val * v1[a] * v1[b];
  const p2 = powerIter(C2, 200);
  const v2 = p2.vec;

  projectionPoints = [];
  const xs = [], ys = [];
  for (let i=0;i<S;++i) {
    const row = X[i];
    let x=0,y=0;
    for (let d=0; d<D; ++d) { x += row[d]*v1[d]; y += row[d]*v2[d]; }
    xs.push(x); ys.push(y);
    const raw = reverseItem[sample[i]];
    const meta = items.get(raw) || { title: `#${raw}` };
    projectionPoints.push({ x, y, title: meta.title, sx: 0, sy: 0 });
  }

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cw = projCanvas.width, ch = projCanvas.height;
  projCtx.clearRect(0,0,cw,ch);
  projCtx.fillStyle = '#fff'; projCtx.fillRect(0,0,cw,ch);
  const pad = 20;
  for (const p of projectionPoints) {
    p.sx = pad + ((p.x - minX)/(maxX - minX || 1)) * (cw - pad*2);
    p.sy = pad + ((p.y - minY)/(maxY - minY || 1)) * (ch - pad*2);
    projCtx.beginPath();
    projCtx.fillStyle = 'rgba(176,59,110,0.9)';
    projCtx.arc(p.sx, p.sy, 3.5, 0, Math.PI*2);
    projCtx.fill();
  }
  statustext.textContent = `projection drawn (sample ${projectionPoints.length})`;
}

// tooltip for projection
projCanvas.addEventListener('mousemove', (ev) => {
  const r = projCanvas.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  let nearest = null, nd = Infinity;
  for (const p of projectionPoints) {
    const dx = x - p.sx, dy = y - p.sy, d = dx*dx + dy*dy;
    if (d < nd) { nd = d; nearest = p; }
  }
  if (nearest && nd < 400) {
    tooltip.style.display = 'block';
    tooltip.style.left = (ev.clientX + 10) + 'px';
    tooltip.style.top = (ev.clientY + 10) + 'px';
    tooltip.textContent = nearest.title;
  } else tooltip.style.display = 'none';
});
projCanvas.addEventListener('mouseleave', () => tooltip.style.display = 'none');

// ---------- Testing: 3-column comparison ----------
async function testOnce() {
  if (!model) { statustext.textContent = 'build model first'; return; }
  const eligible = [...userToRatings.entries()].filter(([u,arr]) => arr.length >= 20).map(([u]) => u);
  if (!eligible.length) { statustext.textContent = 'no user with >=20 ratings'; return; }
  const uRaw = randChoice(eligible);
  const rated = userToRatings.get(uRaw);
  const left = rated.slice(0,10).map(x => ({ title: (items.get(x.itemId) || { title: `#${x.itemId}` }).title, rating: x.rating, iIdx: x.iIdx }));

  // Deep recommendations
  const uIdx = userIndex.get(uRaw);
  const uEmb = model.getUserEmbeddingTensor(uIdx); // tf.Tensor [1? D] or [D]
  // shape may be [1,D] or [D]; ensure column vector
  let uCol;
  if (uEmb.rank === 1) uCol = uEmb.reshape([CONFIG.embeddingDim, 1]); else uCol = uEmb.reshape([CONFIG.embeddingDim, 1]);

  const scores = new Float32Array(numItems);
  const chunk = 1024;
  for (let start=0; start<numItems; start+=chunk) {
    const end = Math.min(numItems, start+chunk);
    const idxArr = [];
    for (let k=start;k<end;++k) idxArr.push(k);
    const idxT = tf.tensor1d(idxArr, 'int32');
    const itEmb = model.itemForward(idxT); // [M,D]
    const prod = tf.matMul(itEmb, uCol).reshape([end-start]);
    const arr = await prod.data();
    for (let i=0;i<arr.length;++i) scores[start+i] = arr[i];
    idxT.dispose(); itEmb.dispose(); prod.dispose();
  }
  uCol.dispose(); uEmb.dispose();

  const ratedSet = new Set(rated.map(r => r.iIdx).filter(x => x !== undefined));
  const cand = [];
  for (let i=0;i<numItems;++i) if (!ratedSet.has(i)) cand.push({ idx: i, score: scores[i] });
  cand.sort((a,b)=> b.score - a.score);
  const deepTop = cand.slice(0,10).map(c => ({ title: (items.get(reverseItem[c.idx])||{title:`#${reverseItem[c.idx]}`}).title, score: c.score, idx: c.idx }));

  // Baseline (popularity)
  const popArr = [];
  for (let i=0;i<numItems;++i) if (!ratedSet.has(i)) popArr.push({ idx:i, cnt: popularity.get(i) || 0 });
  popArr.sort((a,b)=> b.cnt - a.cnt);
  const baseTop = popArr.slice(0,10).map(c => ({ title: (items.get(reverseItem[c.idx])||{title:`#${reverseItem[c.idx]}`}).title, count: c.cnt, idx: c.idx }));

  renderComparison(left, deepTop, baseTop, uRaw);
  drawComparisonChart(left, deepTop, baseTop);
}

// render 3-column table
function renderComparison(left, deep, base, uRaw) {
  resultsDiv.innerHTML = '';
  const container = document.createElement('div');
  container.innerHTML = `
    <div style="text-align:left; margin-bottom:8px"><strong>User:</strong> ${uRaw}</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <div style="flex:1; min-width:160px; background:#fff; border-radius:8px; padding:8px; border:1px solid #fff0f4">
        <div style="font-weight:600; color:#b03b6e; margin-bottom:6px">Top-10 Rated</div>
        <table><tbody id="lbody"></tbody></table>
      </div>
      <div style="flex:1; min-width:160px; background:#fff; border-radius:8px; padding:8px; border:1px solid #fff0f4">
        <div style="font-weight:600; color:#b03b6e; margin-bottom:6px">Recommended (Deep)</div>
        <table><tbody id="mbody"></tbody></table>
      </div>
      <div style="flex:1; min-width:160px; background:#fff; border-radius:8px; padding:8px; border:1px solid #fff0f4">
        <div style="font-weight:600; color:#b03b6e; margin-bottom:6px">Recommended (Baseline)</div>
        <table><tbody id="rbody"></tbody></table>
      </div>
    </div>
  `;
  resultsDiv.appendChild(container);
  const lbody = document.getElementById('lbody');
  const mbody = document.getElementById('mbody');
  const rbody = document.getElementById('rbody');
  left.forEach((it,i)=> {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="width:28px">${i+1}</td><td>${it.title}</td><td style="width:40px;text-align:right">${it.rating}</td>`;
    lbody.appendChild(tr);
  });
  deep.forEach((it,i)=> {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="width:28px">${i+1}</td><td>${it.title}</td><td style="width:40px;text-align:right">${it.score.toFixed(3)}</td>`;
    mbody.appendChild(tr);
  });
  base.forEach((it,i)=> {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="width:28px">${i+1}</td><td>${it.title}</td><td style="width:40px;text-align:right">${it.count}</td>`;
    rbody.appendChild(tr);
  });
}

// comparison chart: overlap count
function drawComparisonChart(left, deep, base) {
  const leftSet = new Set(left.map(x=>x.title));
  const deepOverlap = deep.filter(x=> leftSet.has(x.title)).length;
  const baseOverlap = base.filter(x=> leftSet.has(x.title)).length;

  const ctx = compCtx;
  const w = compCanvas.width, h = compCanvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
  const barW = 120, gap = 60;
  const startX = (w - (barW*2 + gap))/2;
  const maxVal = 10;
  const scale = (h - 40) / maxVal;
  // Deep bar
  ctx.fillStyle = '#ff5fa8';
  ctx.fillRect(startX, h - 20 - deepOverlap*scale, barW, deepOverlap*scale);
  ctx.fillStyle = '#b03b6e'; ctx.font = '13px Inter';
  ctx.fillText(`Deep overlap: ${deepOverlap}/10`, startX, h - 4);
  // Baseline bar
  ctx.fillStyle = '#ffc1db';
  ctx.fillRect(startX + barW + gap, h - 20 - baseOverlap*scale, barW, baseOverlap*scale);
  ctx.fillStyle = '#b03b6e';
  ctx.fillText(`Baseline overlap: ${baseOverlap}/10`, startX + barW + gap, h - 4);
}

// ---------- UI wiring ----------
btnLoad.addEventListener('click', async () => {
  btnLoad.disabled = true;
  try { await loadData(); } finally { btnLoad.disabled = false; }
});

btnTrain.addEventListener('click', async () => {
  if (!interactions.length) { statustext.textContent = 'load data first'; return; }
  buildModel();
  await trainLoop();
});

btnTest.addEventListener('click', async () => {
  await testOnce();
});

// ---------- buildModel toggles ----------
const _origBuildModel = buildModel;
buildModel = function() {
  _origBuildModel();
  btnTest.disabled = false;
};

// ---------- retina crisping ----------
function crispCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
[lossCanvas, compCanvas, projCanvas].forEach(crispCanvas);

// ---------- initial status ----------
statustext.textContent = 'ready — click Load Data';

// ---------- end app.js ----------
