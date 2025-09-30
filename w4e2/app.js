// app.js
// ------------------------------------------------------------
// Global state
let interactions = [];
let items = new Map();
let users = new Set();
let user2idx = new Map(), idx2user = [];
let item2idx = new Map(), idx2item = [];
let userRatings = new Map();
let model;
const config = { embeddingDim:32, epochs:5, batchSize:512, learningRate:0.01, maxInteractions:80000 };

// ------------------------------------------------------------
// UI elements
const statusEl = document.getElementById('status');
const lossCanvas = document.getElementById('lossChart');
const embedCanvas = document.getElementById('embedCanvas');
const resultsEl = document.getElementById('results');

// ------------------------------------------------------------
// Load dataset
async function loadData() {
  statusEl.textContent = 'Loading data...';
  const [uData, uItem] = await Promise.all([
    fetch('data/u.data').then(r=>r.text()),
    fetch('data/u.item').then(r=>r.text())
  ]);

  // Parse items
  items.clear();
  uItem.split('\n').forEach(line=>{
    if(!line.trim()) return;
    const parts = line.split('|');
    const id = parseInt(parts[0]);
    let title = parts[1]||'';
    let year = '';
    const m = title.match(/\((\d{4})\)$/);
    if(m) year = m[1];
    items.set(id,{title, year});
  });

  // Parse interactions
  interactions = [];
  userRatings.clear(); users.clear();
  uData.split('\n').slice(0,config.maxInteractions).forEach(line=>{
    if(!line.trim()) return;
    const [u,i,r,t] = line.trim().split('\t');
    const userId = parseInt(u), itemId = parseInt(i), rating = parseInt(r), ts=parseInt(t);
    interactions.push({userId,itemId,rating,ts});
    users.add(userId);
    if(!userRatings.has(userId)) userRatings.set(userId,[]);
    userRatings.get(userId).push({itemId,rating,ts});
  });

  // Sort each user's ratings
  for(const [u,arr] of userRatings.entries()){
    arr.sort((a,b)=> b.rating!==a.rating ? b.rating-a.rating : b.ts - a.ts );
  }

  // Build indexers
  user2idx.clear(); idx2user=[];
  Array.from(users).forEach((u,idx)=>{user2idx.set(u,idx); idx2user[idx]=u;});
  item2idx.clear(); idx2item=[];
  Array.from(items.keys()).forEach((i,idx)=>{item2idx.set(i,idx); idx2item[idx]=i;});

  statusEl.textContent = `Loaded ${interactions.length} interactions, ${users.size} users, ${items.size} items.`;
}

// ------------------------------------------------------------
// Draw simple loss chart
function drawLoss(losses){
  const ctx = lossCanvas.getContext('2d');
  ctx.clearRect(0,0,lossCanvas.width,lossCanvas.height);
  ctx.strokeStyle = 'blue';
  ctx.beginPath();
  losses.forEach((l,i)=>{
    const x = i/(losses.length-1) * lossCanvas.width;
    const y = lossCanvas.height - (l/Math.max(...losses))*lossCanvas.height;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

// ------------------------------------------------------------
// PCA projection for item embeddings
function projectAndDraw(embeddings, sampleSize=500){
  const ctx = embedCanvas.getContext('2d');
  ctx.clearRect(0,0,embedCanvas.width,embedCanvas.height);
  const n = Math.min(sampleSize, embeddings.length);
  const data = embeddings.slice(0,n);
  // mean center
  const dim = data[0].length;
  const mean = new Array(dim).fill(0);
  data.forEach(v=>v.forEach((val,j)=>mean[j]+=val));
  for(let j=0;j<dim;j++) mean[j]/=n;
  const X = data.map(v=>v.map((val,j)=>val-mean[j]));
  // covariance
  const cov = Array(dim).fill(0).map(()=>Array(dim).fill(0));
  X.forEach(x=>{
    for(let i=0;i<dim;i++)for(let j=0;j<dim;j++) cov[i][j]+=x[i]*x[j];
  });
  for(let i=0;i<dim;i++)for(let j=0;j<dim;j++) cov[i][j]/=n;
  // simple power method for first 2 eigenvectors
  function powerIter(mat,iters=50){
    let v = Array(mat.length).fill(0).map(()=>Math.random());
    for(let it=0;it<iters;it++){
      let v2 = Array(mat.length).fill(0);
      for(let i=0;i<mat.length;i++)
        for(let j=0;j<mat.length;j++)
          v2[i]+=mat[i][j]*v[j];
      const norm = Math.sqrt(v2.reduce((a,b)=>a+b*b,0));
      v = v2.map(x=>x/norm);
    }
    return v;
  }
  const pc1 = powerIter(cov);
  // deflate
  const lambda = pc1.reduce((s,vi,i)=>s+vi*cov[i].reduce((a,b,j)=>a+b*pc1[j],0),0);
  for(let i=0;i<dim;i++)for(let j=0;j<dim;j++) cov[i][j]-=lambda*pc1[i]*pc1[j];
  const pc2 = powerIter(cov);

  const proj = X.map(x=>[
    x.reduce((s,val,j)=>s+val*pc1[j],0),
    x.reduce((s,val,j)=>s+val*pc2[j],0)
  ]);
  const xs = proj.map(p=>p[0]), ys=proj.map(p=>p[1]);
  const minx=Math.min(...xs), maxx=Math.max(...xs);
  const miny=Math.min(...ys), maxy=Math.max(...ys);
  ctx.fillStyle='rgba(0,0,150,0.6)';
  proj.forEach(p=>{
    const x = (p[0]-minx)/(maxx-minx) * embedCanvas.width;
    const y = embedCanvas.height - (p[1]-miny)/(maxy-miny) * embedCanvas.height;
    ctx.fillRect(x,y,2,2);
  });
}

// ------------------------------------------------------------
// Training
async function trainModel(){
  statusEl.textContent = 'Initializing model...';
  model = new TwoTowerModel(users.size, items.size, config.embeddingDim);
  model.compile(config.learningRate);

  // Prepare batches
  const batches=[];
  for(let e of interactions){
    const u = user2idx.get(e.userId);
    const i = item2idx.get(e.itemId);
    batches.push([u,i]);
  }

  const losses=[];
  statusEl.textContent = 'Training...';
  for(let ep=0; ep<config.epochs; ep++){
    tf.util.shuffle(batches);
    let epLoss=0;
    for(let bi=0; bi<batches.length; bi+=config.batchSize){
      const batch = batches.slice(bi,bi+config.batchSize);
      const uTensor = tf.tensor1d(batch.map(x=>x[0]),'int32');
      const iTensor = tf.tensor1d(batch.map(x=>x[1]),'int32');
      const loss = await model.trainStep(uTensor, iTensor);
      epLoss += loss;
      uTensor.dispose(); iTensor.dispose();
    }
    losses.push(epLoss/(batches.length/config.batchSize));
    drawLoss(losses);
    statusEl.textContent = `Epoch ${ep+1}/${config.epochs} done. Loss=${losses[losses.length-1].toFixed(4)}`;
    await tf.nextFrame();
  }

  // Get item embeddings
  const allItemIdx = tf.tensor1d([...Array(items.size).keys()],'int32');
  const embTensor = model.itemForward(allItemIdx);
  const embArr = await embTensor.array();
  projectAndDraw(embArr, 500);
  embTensor.dispose(); allItemIdx.dispose();

  statusEl.textContent = 'Training completed.';
}

// ------------------------------------------------------------
// Testing
async function testModel(){
  statusEl.textContent = 'Testing...';
  // pick random user with >=20 ratings
  let candidateUsers = [...userRatings.keys()].filter(u=>userRatings.get(u).length>=20);
  const uId = candidateUsers[Math.floor(Math.random()*candidateUsers.length)];
  const uIdx = user2idx.get(uId);
  const history = userRatings.get(uId).slice(0,10); // top10 historical

  // Baseline: dot product of base embeddings
  const userBaseEmb = await model.getUserBaseEmbedding(uIdx);
  const itemBaseEmb = await model.getAllItemBaseEmbeddings();
  const scoresBase = itemBaseEmb.map(v=>dot(userBaseEmb,v));
  const ratedSet = new Set(userRatings.get(uId).map(x=>x.itemId));
  const recBase = topKExclude(scoresBase, ratedSet, 10).map(([idx,score])=>({itemId:idx2item[idx], score}));

  // DL model
  const uEmb = await model.getUserEmbedding(uIdx);
  const itemEmbMatrix = await model.getAllItemEmbeddings();
  const scoresDL = itemEmbMatrix.map(v=>dot(uEmb,v));
  const recDL = topKExclude(scoresDL, ratedSet, 10).map(([idx,score])=>({itemId:idx2item[idx], score}));

  renderResults(history, recBase, recDL);
  statusEl.textContent = `Test completed for user ${uId}.`;
}

function dot(a,b){ return a.reduce((s,v,i)=>s+v*b[i],0); }
function topKExclude(scores, excludeSet, K){
  const arr = scores.map((s,i)=>[i,s]).filter(([i])=>!excludeSet.has(idx2item[i]));
  arr.sort((a,b)=>b[1]-a[1]);
  return arr.slice(0,K);
}

// ------------------------------------------------------------
// Rendering tables
function renderResults(history, recBase, recDL){
  function makeTable(title, rows, colScore){
    let html = `<table><thead><tr><th colspan="4">${title}</th></tr>`;
    html += `<tr><th>Rank</th><th>Movie</th><th>${colScore}</th><th>Year</th></tr></thead><tbody>`;
    rows.forEach((r,i)=>{
      const it = items.get(r.itemId);
      html += `<tr><td>${i+1}</td><td>${it.title}</td><td>${r.rating||r.score.toFixed(3)}</td><td>${it.year||''}</td></tr>`;
    });
    html += `</tbody></table>`;
    return html;
  }
  resultsEl.innerHTML = `<div class="tables-container">
    ${makeTable('Historical Top-10', history, 'Rating')}
    ${makeTable('Baseline Top-10', recBase, 'Score')}
    ${makeTable('Two-Tower DL Top-10', recDL, 'Score')}
  </div>`;
}

// ------------------------------------------------------------
// Button actions
document.getElementById('loadBtn').onclick = loadData;
document.getElementById('trainBtn').onclick = trainModel;
document.getElementById('testBtn').onclick = testModel;
