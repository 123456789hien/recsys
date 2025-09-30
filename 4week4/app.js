// app.js
// Two-Tower demo wiring: data load, train, test, visualizations
// Clear, commented sections. Matches IDs from index.html.

// ---------- Config ----------
const CONFIG = {
  embeddingDim: 32,
  epochs: 6,
  batchSize: 256,
  learningRate: 0.005,
  maxInteractions: 80000,
  projectionSample: 1000,
  lossPlotMax: 2000
};

// ---------- State ----------
let interactions = []; // {uRaw, iRaw, rating, ts, uIdx, iIdx}
let items = new Map(); // rawItemId -> { title, year, genres: [0/1...] }
let userToRatings = new Map(); // rawUserId -> [{ itemId, rating, ts, iIdx }]
let userIndex = new Map(), itemIndex = new Map();
let reverseUser = [], reverseItem = [];
let numUsers = 0, numItems = 0, numGenres = 0;
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

// crisp canvases for retina
function crispCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr || canvas.width);
  canvas.height = Math.round(rect.height * dpr || canvas.height);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
[lossCanvas, compCanvas, projCanvas].forEach(crispCanvas);

// ---------- Utilities ----------
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
  btnLoad.disabled = true;
  try {
    const [udataTxt, uitemTxt] = await Promise.all([fetchText('data/u.data'), fetchText('data/u.item')]);

    // parse u.item: format: movie id | movie title | release date | video release date | IMDb URL | 19 genre flags...
    items.clear();
    uitemTxt.split(/\r?\n/).forEach(line => {
      if (!line.trim()) return;
      const parts = line.split('|');
      const rawId = Number(parts[0]);
      const title = (parts[1] || '').trim();
      const m = title.match(/\((\d{4})\)$/);
      const year = m ? Number(m[1]) : null;
      // genres: parts[5..23] (19 flags)
      const genres = (parts.slice(5)).slice(0,19).map(s => Number(s || 0));
      if (genres.length > numGenres) numGenres = genres.length;
      items.set(rawId, { title, year, genres });
    });

    // parse u.data: user_id \t item_id \t rating \t ts
    interactions = [];
    udataTxt.split(/\r?\n/).forEach(line => {
      if (!line.trim()) return;
      const p = line.split('\t');
      if (p.length < 4) return;
      interactions.push({ uRaw: Number(p[0]), iRaw: Number(p[1]), rating: Number(p[2]), ts: Number(p[3]) });
    });

    // keep most recent interactions up to cap for memory control
    interactions.sort((a,b) => b.ts - a.ts);
    if (interactions.length > CONFIG.maxInteractions) interactions = interactions.slice(0, CONFIG.maxInteractions);

    // Build indexers: include all items from items map and any item appearing in interactions
    userIndex.clear(); itemIndex.clear(); reverseUser = []; reverseItem = [];
    let uc = 0, ic = 0;
    // ensure items from items map exist in index
    for (const raw of items.keys()) {
      itemIndex.set(raw, ic++); reverseItem.push(raw);
    }
    // ensure items from interactions also present
    for (const it of interactions) {
      if (!itemIndex.has(it.iRaw)) { itemIndex.set(it.iRaw, ic++); reverseItem.push(it.iRaw); items.set(it.iRaw, { title: `#${it.iRaw}`, year: null, genres: Array(numGenres).fill(0) }); }
      if (!userIndex.has(it.uRaw)) { userIndex.set(it.uRaw, uc++); reverseUser.push(it.uRaw); }
    }
    numUsers = uc; numItems = ic;

    // attach indices and build per-user lists
    userToRatings.clear();
    for (const it of interactions) {
      it.uIdx = userIndex.get(it.uRaw);
      it.iIdx = itemIndex.get(it.iRaw);
      if (!userToRatings.has(it.uRaw)) userToRatings.set(it.uRaw, []);
      userToRatings.get(it.uRaw).push({ itemId: it.iRaw, rating: it.rating, ts: it.ts, iIdx: it.iIdx });
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
  } finally {
    btnLoad.disabled = false;
  }
}

// ---------- Loss plot ----------
const LossPlot = {
  pts: [],
  max: CONFIG.lossPlotMax,
  push(v) { this.pts.push(v); if (this.pts.length > this.max) this.pts.shift(); this.draw(); },
  clear() { this.pts = []; this.draw(); },
  draw() {
    const ctx = lossCtx;
    const w = lossCanvas.clientWidth, h = lossCanvas.clientHeight;
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
  // build genres matrix as array [numItems, numGenres]
  const genresArr = [];
  for (let i=0;i<numItems;i++) {
    const raw = reverseItem[i];
    const meta = items.get(raw) || { genres: Array(numGenres).fill(0) };
    const g = (meta.genres || []).slice(0, numGenres);
    // ensure length
    while (g.length < numGenres) g.push(0);
    genresArr.push(g.map(Number));
  }
  model = new TwoTowerModel(numUsers, numItems, CONFIG.embeddingDim, numGenres);
  model.setItemGenres(genresArr);
  model.compile(CONFIG.learningRate);
  btnTest.disabled = false;
  statustext.textContent = `model built (users=${numUsers}, items=${numItems}, genres=${numGenres})`;
}

// ---------- Batching ----------
function makeShuffledPairs() {
  const arr = interactions.map(it => ({ uIdx: it.uIdx, iIdx: it.iIdx }));
  for (let i = arr.length-1; i>0; --i) { const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; }
  return arr;
}

// ---------- Training loop ----------
async function trainLoop() {
  if (!model) buildModel();
  LossPlot.clear();
  stopRequested = false;
  btnStop.disabled = false; btnTrain.disabled = true; btnLoad.disabled = true; btnTest.disabled = true;
  statustext.textContent = `training started (${now()})`;

  const pairs = makeShuffledPairs();
  const totalBatches = Math.ceil(pairs.length / CONFIG.batchSize);
  for (let ep=0; ep<CONFIG.epochs; ++ep) {
    let batchIdx = 0;
    for (let i=0;i<pairs.length;i+=CONFIG.batchSize) {
      if (stopRequested) {
        statustext.textContent = 'training stopped';
        btnStop.disabled = true; btnTrain.disabled = false; btnLoad.disabled = false; btnTest.disabled = false;
        return;
      }
      const batch = pairs.slice(i, i+CONFIG.batchSize);
      const uArr = batch.map(x=>x.uIdx);
      const iArr = batch.map(x=>x.iIdx);
      const uT = tf.tensor1d(uArr, 'int32');
      const iT = tf.tensor1d(iArr, 'int32');

      // train step returns numeric loss
      const lossVal = await model.trainStep(uT, iT, useBPR.checked);
      LossPlot.push(lossVal);

      uT.dispose(); iT.dispose();
      batchIdx++;
      if (batchIdx % 5 === 0) {
        statustext.textContent = `epoch ${ep+1}/${CONFIG.epochs} batch ${batchIdx}/${totalBatches} loss=${lossVal.toFixed(4)} (${now()})`;
        await tf.nextFrame();
      }
    }
  }

  btnStop.disabled = true; btnTrain.disabled = false; btnLoad.disabled = false; btnTest.disabled = false;
  statustext.textContent = `training finished (${now()})`;

  await drawProjection();
}

// stop button
btnStop.addEventListener('click', () => { stopRequested = true; btnStop.disabled = true; });

// ---------- Projection (PCA via covariance + power iteration) ----------
let projectionPoints = [];
async function drawProjection() {
  statustext.textContent = 'computing projection...';
  const sampleSize = Math.min(CONFIG.projectionSample, numItems);
  if (sampleSize === 0) { statustext.textContent = 'no items to project'; return; }
  // sample indices
  const all = [...Array(numItems).keys()];
  const sample = [];
  for (let i=0;i<sampleSize;++i) {
    const j = Math.floor(Math.random()*all.length);
    sample.push(all.splice(j,1)[0]);
  }

  // get embeddings for sample
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
  const cw = projCanvas.clientWidth, ch = projCanvas.clientHeight;
  projCtx.clearRect(0,0,cw,ch);
  projCtx.fillStyle = '#fff'; projCtx.fillRect(0,0,cw,ch);
  const pad = 20;
  for (const p of projectionPoints) {
    p.sx = pad + ((p.x - minX)/(maxX - minX || 1)) * (cw - pad*2);
    p.sy = pad + ((p.y - minY)/(maxY - minY || 1)) * (ch - pad*2);
    projCtx.beginPath();
    projCtx.fillStyle = 'rgba(176,59,110,0.95)';
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

// ---------- Test pipeline (3-column comparison) ----------
async function testOnce() {
  if (!model) { statustext.textContent = 'build model first'; return; }
  const eligible = [...userToRatings.entries()].filter(([u,arr]) => arr.length >= 20).map(([u]) => u);
  if (!eligible.length) { statustext.textContent = 'no user with >=20 ratings'; return; }
  const uRaw = randChoice(eligible);
  const rated = userToRatings.get(uRaw);
  const left = rated.slice(0,10).map(x => ({ title: (items.get(x.itemId) || { title: `#${x.itemId}` }).title, rating: x.rating, year: items.get(x.itemId)?.year || '' }));

  const uIdx = userIndex.get(uRaw);
  // Baseline: use base embedding tables (no MLP)
  const userBaseEmb = await model.getUserBaseEmbedding(uIdx); // Float32Array D
  const itemBaseEmb = await model.getAllItemBaseEmbeddings(); // [numItems][D]
  const scoresBase = new Float32Array(numItems);
  for (let i=0;i<numItems;++i) scoresBase[i] = dot(userBaseEmb, itemBaseEmb[i]);

  // Deep: compute scores via itemForward in batches
  const scoresDeep = await model.getScoresForUser(uIdx, 1024);

  // exclude already rated
  const ratedSet = new Set(rated.map(r=>r.itemId));
  function topKFromScores(scores, K=10) {
    const cand = [];
    for (let i=0;i<scores.length;++i) {
      const raw = reverseItem[i];
      if (ratedSet.has(raw)) continue;
      cand.push({ idx: i, score: scores[i] });
    }
    cand.sort((a,b)=> b.score - a.score);
    return cand.slice(0,K).map(c => ({ title: (items.get(reverseItem[c.idx])||{title:`#${reverseItem[c.idx]}`}).title, score: c.score, year: items.get(reverseItem[c.idx])?.year || '' }));
  }

  const baseTop = topKFromScores(scoresBase, 10);
  const deepTop = topKFromScores(scoresDeep, 10);

  renderComparison(uRaw, left, baseTop, deepTop);
  drawComparisonChart(left, baseTop, deepTop);
  statustext.textContent = `Test for user ${uRaw} done`;
}

// dot product helper
function dot(a,b){ let s=0; for (let i=0;i<a.length;++i) s+=a[i]*b[i]; return s; }

// render 3-column side-by-side HTML table
function renderComparison(uRaw, left, base, deep) {
  resultsDiv.innerHTML = '';
  const header = document.createElement('div');
  header.style.marginBottom = '8px';
  header.innerHTML = `<strong>User:</strong> ${uRaw} · <span class="small">Left = Historical | Middle = Baseline (ID-embeddings) | Right = Two-Tower (MLP)</span>`;
  resultsDiv.appendChild(header);

  const container = document.createElement('div');
  container.className = 'table-wrap';
  container.style.width = '100%';

  function buildCard(title, rows, scoreLabel) {
    const card = document.createElement('div'); card.className = 'table-card';
    const t = document.createElement('div'); t.className = 'table-title'; t.textContent = title; card.appendChild(t);
    const table = document.createElement('table');
    const thead = document.createElement('thead'); thead.innerHTML = `<tr><th style="width:36px">#</th><th>Movie</th><th style="width:64px">${scoreLabel}</th><th style="width:56px">Year</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach((r,i)=>{
      const tr = document.createElement('tr');
      const score = r.rating !== undefined ? r.rating : (r.score!==undefined ? r.score.toFixed(3) : '');
      tr.innerHTML = `<td>${i+1}</td><td>${r.title}</td><td style="text-align:right">${score}</td><td>${r.year||''}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    card.appendChild(table);
    return card;
  }

  container.appendChild(buildCard('Top-10 Rated (history)', left, 'Rating'));
  container.appendChild(buildCard('Recommended — Baseline (ID-emb)', base, 'Score'));
  container.appendChild(buildCard('Recommended — Two-Tower (MLP)', deep, 'Score'));

  resultsDiv.appendChild(container);
}

// small bar chart comparing overlap with history
function drawComparisonChart(left, base, deep) {
  const leftSet = new Set(left.map(x=>x.title));
  const deepOverlap = deep.filter(x=> leftSet.has(x.title)).length;
  const baseOverlap = base.filter(x=> leftSet.has(x.title)).length;
  const ctx = compCtx;
  const w = compCanvas.clientWidth, h = compCanvas.clientHeight;
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

// ---------- initial status ----------
statustext.textContent = 'ready — click Load Data';

// ---------- end app.js ----------
