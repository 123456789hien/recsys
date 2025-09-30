// app.js
window.addEventListener('load', () => {
  const loadDataBtn = document.getElementById('loadDataBtn');
  const trainBtn = document.getElementById('trainBtn');
  const testBtn = document.getElementById('testBtn');
  const statusEl = document.getElementById('status');
  const lossCanvas = document.getElementById('lossChart');
  const embeddingCanvas = document.getElementById('embeddingCanvas');
  const resultsDiv = document.getElementById('results');

  const lossCtx = lossCanvas.getContext('2d');
  const embedCtx = embeddingCanvas.getContext('2d');

  let interactions = [];
  let items = new Map();
  let userId2Idx = {}, idx2UserId = [];
  let itemId2Idx = {}, idx2ItemId = [];
  let model;
  const config = { epochs: 5, batchSize: 512, embeddingDim: 32, learningRate: 0.01, maxInteractions: 80000 };

  function parseDataLines(dataText) {
    return dataText.trim().split('\n').map(line => {
      const [userId, itemId, rating, ts] = line.split('\t');
      return { userId: parseInt(userId), itemId: parseInt(itemId), rating: parseFloat(rating), ts: parseInt(ts) };
    });
  }

  function parseItemLines(itemText) {
    const lines = itemText.trim().split('\n');
    lines.forEach(line => {
      const parts = line.split('|');
      const itemId = parseInt(parts[0]);
      const title = parts[1];
      const yearMatch = title.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      items.set(itemId, { title, year, genres: parts.slice(5).map(Number) });
    });
  }

  async function loadData() {
    statusEl.innerText = 'Loading data...';
    const [dataResp, itemResp] = await Promise.all([
      fetch('data/u.data'),
      fetch('data/u.item')
    ]);
    const dataText = await dataResp.text();
    const itemText = await itemResp.text();
    interactions = parseDataLines(dataText).slice(0, config.maxInteractions);
    parseItemLines(itemText);

    // Build indexers
    const userSet = new Set(interactions.map(d => d.userId));
    const itemSet = new Set(interactions.map(d => d.itemId));
    idx2UserId = Array.from(userSet);
    idx2ItemId = Array.from(itemSet);
    idx2UserId.forEach((id,i)=> userId2Idx[id]=i);
    idx2ItemId.forEach((id,i)=> itemId2Idx[id]=i);

    statusEl.innerText = `Loaded ${interactions.length} interactions, ${idx2UserId.length} users, ${idx2ItemId.length} items.`;
    trainBtn.disabled = false;
    testBtn.disabled = false;
  }

  function drawLossChart(losses) {
    lossCtx.clearRect(0,0,lossCanvas.width, lossCanvas.height);
    lossCtx.beginPath();
    lossCtx.moveTo(0, lossCanvas.height - losses[0]*100);
    for(let i=1;i<losses.length;i++){
      const x = i*lossCanvas.width/losses.length;
      const y = lossCanvas.height - losses[i]*100;
      lossCtx.lineTo(x,y);
    }
    lossCtx.strokeStyle = '#e74c3c';
    lossCtx.stroke();
  }

  function drawEmbeddingProjection(sampleEmbeddings, sampleTitles) {
    embedCtx.clearRect(0,0,embeddingCanvas.width, embeddingCanvas.height);
    const xs = sampleEmbeddings.map(d=>d[0]);
    const ys = sampleEmbeddings.map(d=>d[1]);
    const minX = Math.min(...xs), maxX=Math.max(...xs);
    const minY = Math.min(...ys), maxY=Math.max(...ys);
    embedCtx.fillStyle = '#3498db';
    sampleEmbeddings.forEach((p,i)=>{
      const x = ((p[0]-minX)/(maxX-minX))*embeddingCanvas.width;
      const y = ((p[1]-minY)/(maxY-minY))*embeddingCanvas.height;
      embedCtx.beginPath();
      embedCtx.arc(x,embeddingCanvas.height - y,4,0,2*Math.PI);
      embedCtx.fill();
    });
  }

  async function trainModel() {
    statusEl.innerText = 'Training...';
    const numUsers = idx2UserId.length;
    const numItems = idx2ItemId.length;
    model = new TwoTowerModel(numUsers,numItems,config.embeddingDim, items, config.learningRate);
    let losses = [];

    for(let e=0;e<config.epochs;e++){
      for(let i=0;i<interactions.length;i+=config.batchSize){
        const batch = interactions.slice(i,i+config.batchSize);
        const lossVal = await model.trainStep(batch, userId2Idx, itemId2Idx);
        losses.push(lossVal);
      }
      drawLossChart(losses);
      statusEl.innerText = `Training epoch ${e+1}/${config.epochs}, latest loss ${losses[losses.length-1].toFixed(4)}`;
    }

    // Embedding projection (PCA 2D)
    const sampleItems = Array.from(items.keys()).slice(0,1000);
    const embeddings = await model.getItemEmbeddings(sampleItems.map(id=>itemId2Idx[id]));
    const projected = tf.tidy(()=>{
      const X = tf.tensor2d(embeddings);
      const mean = X.mean(0);
      const centered = X.sub(mean);
      const cov = centered.transpose().matMul(centered);
      const { s, u } = tf.linalg.svd(cov);
      const W = u.slice([0,0],[u.shape[0],2]);
      const Y = centered.matMul(W);
      return Y.arraySync();
    });
    drawEmbeddingProjection(projected, sampleItems.map(id=>items.get(id).title));
    statusEl.innerText += ' | Training completed.';
  }

  function topK(arr, k) {
    return arr.sort((a,b)=>b[1]-a[1]).slice(0,k);
  }

  async function testModel() {
    resultsDiv.innerHTML = '';
    const userCounts = {};
    interactions.forEach(d=> userCounts[d.userId]=(userCounts[d.userId]||0)+1);
    const eligibleUsers = Object.keys(userCounts).filter(u=>userCounts[u]>=20).map(Number);
    const userId = eligibleUsers[Math.floor(Math.random()*eligibleUsers.length)];
    const uIdx = userId2Idx[userId];

    // Historical top-10
    const hist = interactions.filter(d=>d.userId===userId).sort((a,b)=>b.rating - a.rating || b.ts - a.ts).slice(0,10)
      .map(d=> [items.get(d.itemId).title, d.rating, items.get(d.itemId).year]);

    // Simple embedding (item mean ratings) top-10
    const itemMeans = {};
    interactions.forEach(d=> {
      itemMeans[d.itemId]= (itemMeans[d.itemId]||[]).concat(d.rating);
    });
    const simpleScores = idx2ItemId.map(id=>{
      const scores = itemMeans[id]||[0];
      return [id, scores.reduce((a,b)=>a+b,0)/scores.length];
    });
    const topSimple = simpleScores.filter(d=>!interactions.find(x=>x.userId===userId && x.itemId===d[0]))
      .sort((a,b)=>b[1]-a[1]).slice(0,10).map(d=>[items.get(d[0]).title, d[1], items.get(d[0]).year]);

    // Two-Tower top-10
    const topDL = await model.recommendForUser(uIdx,10);

    // Render table
    const table = document.createElement('table');
    const header = table.insertRow();
    ['Rank','Historical','Rating','Year','Top-10 Simple','Score','Year','Top-10 DL','Score','Year'].forEach(h=> {
      const th = document.createElement('th'); th.innerText=h; header.appendChild(th);
    });
    for(let i=0;i<10;i++){
      const row = table.insertRow();
      row.insertCell().innerText = i+1;
      row.insertCell().innerText = hist[i][0];
      row.insertCell().innerText = hist[i][1];
      row.insertCell().innerText = hist[i][2]||'';
      row.insertCell().innerText = topSimple[i][0];
      row.insertCell().innerText = topSimple[i][1].toFixed(2);
      row.insertCell().innerText = topSimple[i][2]||'';
      row.insertCell().innerText = topDL[i][0];
      row.insertCell().innerText = topDL[i][1].toFixed(2);
      row.insertCell().innerText = topDL[i][2]||'';
    }
    resultsDiv.appendChild(table);
    statusEl.innerText = `Tested for user ${userId}.`;
  }

  loadDataBtn.addEventListener('click', loadData);
  trainBtn.addEventListener('click', trainModel);
  testBtn.addEventListener('click', testModel);
});
