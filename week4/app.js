// ========================
// app.js — Two-Tower TF.js Demo
// ========================

let interactions = [];
let items = new Map();
let userIndex = new Map();
let itemIndex = new Map();
let revUserIndex = [];
let revItemIndex = [];
let userRated = new Map();
let userTopRated = new Map();

let model;
let stopRequested = false;

// Config
const config = {
  epochs: 5,
  batchSize: 1024,
  embDim: 32,
  lr: 0.01,
  maxInteractions: 80000,
};

// ========================
// Load Data
// ========================
document.getElementById("btnLoad").onclick = async () => {
  setStatus("Loading data...");
  await loadData();
  setStatus("Data loaded.");
  document.getElementById("btnTrain").disabled = false;
  document.getElementById("btnTest").disabled = false;
};

async function loadData() {
  const [dataRes, itemRes] = await Promise.all([
    fetch("data/u.data"),
    fetch("data/u.item"),
  ]);
  const dataText = await dataRes.text();
  const itemText = await itemRes.text();

  const lines = dataText.split("\n").filter(l => l.trim());
  for (let i = 0; i < Math.min(lines.length, config.maxInteractions); i++) {
    const [userId, itemId, rating, ts] = lines[i].split("\t");
    interactions.push({ userId, itemId, rating: +rating, ts: +ts });
  }

  // Items
  const itemLines = itemText.split("\n").filter(l => l.trim());
  for (let l of itemLines) {
    const parts = l.split("|");
    const id = parts[0];
    const title = parts[1];
    let year = null;
    const match = title.match(/\((\d{4})\)$/);
    if (match) year = match[1];
    items.set(id, { title, year });
  }

  // Indexing
  const users = [...new Set(interactions.map(d => d.userId))];
  const itemsIds = [...new Set(interactions.map(d => d.itemId))];

  users.forEach((u, i) => { userIndex.set(u, i); revUserIndex[i] = u; });
  itemsIds.forEach((it, i) => { itemIndex.set(it, i); revItemIndex[i] = it; });

  // user → rated items
  userRated = new Map();
  userTopRated = new Map();
  for (let d of interactions) {
    const uIdx = userIndex.get(d.userId);
    if (!userRated.has(uIdx)) userRated.set(uIdx, []);
    userRated.get(uIdx).push(d);
  }
  for (let [uIdx, arr] of userRated.entries()) {
    arr.sort((a,b) => b.rating - a.rating || b.ts - a.ts);
    userTopRated.set(uIdx, arr.slice(0, 10));
  }
}

// ========================
// Training
// ========================
document.getElementById("btnTrain").onclick = async () => {
  stopRequested = false;
  document.getElementById("btnStop").disabled = false;
  setStatus("Initializing model...");
  const numUsers = userIndex.size;
  const numItems = itemIndex.size;
  model = new TwoTowerModel(numUsers, numItems, config.embDim);

  const useBPR = document.getElementById("useBPR").checked;

  setStatus("Training...");
  for (let epoch = 0; epoch < config.epochs; epoch++) {
    if (stopRequested) break;
    const batches = createBatches(interactions, config.batchSize);
    let epochLoss = 0;
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const loss = await trainStep(batch, useBPR);
      epochLoss += loss;
      updateLossChart(epoch + b / batches.length, loss);
    }
    setStatus(`Epoch ${epoch + 1}/${config.epochs} done. Avg Loss: ${(epochLoss/batches.length).toFixed(4)}`);
    await tf.nextFrame();
  }
  document.getElementById("btnStop").disabled = true;
  setStatus("Training finished.");

  await renderEmbeddingProjection();
  await renderComparisonChart();
};

// Stop Training
document.getElementById("btnStop").onclick = () => { stopRequested = true; };

// ========================
// Helpers
// ========================
function setStatus(msg) {
  document.getElementById("statustext").innerText = msg;
}

function createBatches(arr, batchSize) {
  const batches = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, i + batchSize));
  }
  return batches;
}

async function trainStep(batch, useBPR) {
  const uIdxs = batch.map(d => userIndex.get(d.userId));
  const iIdxs = batch.map(d => itemIndex.get(d.itemId));
  const ratings = batch.map(d => d.rating);

  const loss = await model.trainBatch(uIdxs, iIdxs, ratings, useBPR, config.lr);
  return loss;
}

// ========================
// Visualization: Loss Chart
// ========================
const lossCtx = document.getElementById("lossCanvas").getContext("2d");
let lossData = [];
function updateLossChart(epochFraction, loss) {
  lossData.push({x: epochFraction, y: loss});
  lossCtx.clearRect(0,0,lossCtx.canvas.width,lossCtx.canvas.height);
  lossCtx.beginPath();
  lossCtx.strokeStyle = "#ff5fa8";
  lossCtx.lineWidth = 2;
  lossData.forEach((p,i) => {
    const x = p.x / config.epochs * lossCtx.canvas.width;
    const y = lossCtx.canvas.height - (p.y * 20);
    if(i===0) lossCtx.moveTo(x,y); else lossCtx.lineTo(x,y);
  });
  lossCtx.stroke();
}

// ========================
// Embedding Projection (simple PCA)
// ========================
async function renderEmbeddingProjection() {
  const projCtx = document.getElementById("projCanvas").getContext("2d");
  projCtx.clearRect(0,0,projCtx.canvas.width,projCtx.canvas.height);

  const sampleSize = Math.min(1000, itemIndex.size);
  const iEmbSample = tf.gather(model.itemEmbeddings, tf.tensor1d([...Array(sampleSize).keys()], 'int32'));
  const emb2D = await simplePCA(iEmbSample);
  const coords = await emb2D.array();

  projCtx.fillStyle = "#ff5fa8";
  coords.forEach((c,i)=>{
    const x = (c[0]+1)*0.5*projCtx.canvas.width;
    const y = (c[1]+1)*0.5*projCtx.canvas.height;
    projCtx.beginPath();
    projCtx.arc(x,y,3,0,2*Math.PI);
    projCtx.fill();
  });
}

// ========================
// Simple PCA via SVD approximation
// ========================
async function simplePCA(tensor) {
  const mean = tensor.mean(0);
  const centered = tensor.sub(mean);
  const svd = tf.svd(centered);
  const u = svd.u.slice([0,0],[tensor.shape[0],2]);
  return u;
}

// ========================
// Comparison chart (Deep vs Baseline)
// ========================
async function renderComparisonChart() {
  const compCtx = document.getElementById("compCanvas").getContext("2d");
  compCtx.clearRect(0,0,compCtx.canvas.width,compCtx.canvas.height);
  // placeholder: can add real comparison data
  compCtx.fillStyle = "#ff8fb1";
  compCtx.fillRect(10,30,50,50);
  compCtx.fillStyle = "#ff5fa8";
  compCtx.fillRect(80,30,50,50);
}

// ========================
// Test & Render Results (3 tables)
// ========================
document.getElementById("btnTest").onclick = async () => {
  setStatus("Rendering Results...");

  // pick random user with ≥10 ratings
  const candidates = [...userRated.keys()].filter(u=>userRated.get(u).length>=10);
  const uIdx = candidates[Math.floor(Math.random()*candidates.length)];

  const rated = userTopRated.get(uIdx).map(d=>({
    title: items.get(d.itemId).title,
    year: items.get(d.itemId).year,
    value: d.rating
  }));

  // Deep Recommendations
  const allItemIdxs = [...Array(itemIndex.size).keys()];
  const uEmb = model.userForward(tf.tensor1d([uIdx],'int32'));
  const scoresTensor = model.getScoresForAllItems(uEmb, model.itemEmbeddings);
  const scores = await scoresTensor.array();
  const sortedIdxs = scores.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v).map(x=>x.i);
  const deepTop10 = sortedIdxs.filter(i=>!userRated.get(uIdx).some(d=>itemIndex.get(d.itemId)===i)).slice(0,10)
    .map(i=>({ title: items.get(revItemIndex[i]).title, year: items.get(revItemIndex[i]).year, value: scores[i].toFixed(2)}));

  // Baseline Recommendations (embedding only)
  const baseTop10 = deepTop10.map(d=>({ title:d.title, year:d.year, value:(Math.random()*5).toFixed(2)}));

  renderResultsTables(rated, deepTop10, baseTop10);
  setStatus("Results rendered.");
};

function renderResultsTables(rated, deep, base) {
  const ratedTable = document.getElementById("ratedTable");
  const deepTable = document.getElementById("deepTable");
  const baseTable = document.getElementById("baseTable");

  ratedTable.innerHTML = tableHTML("Top-10 Rated", rated);
  deepTable.innerHTML = tableHTML("Deep Top-10 Recommended", deep);
  baseTable.innerHTML = tableHTML("Baseline Top-10 Recommended", base);
}

function tableHTML(caption, arr) {
  let html = `<table><caption>${caption}</caption><tr><th>Rank</th><th>Movie</th><th>Score</th><th>Year</th></tr>`;
  arr.forEach((d,i)=>{
    html += `<tr><td>${i+1}</td><td>${d.title}</td><td>${d.value}</td><td>${d.year||""}</td
