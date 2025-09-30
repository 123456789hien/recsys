// app.js
document.addEventListener('DOMContentLoaded', async () => {
  const loadDataBtn = document.getElementById('loadDataBtn');
  const trainBtn = document.getElementById('trainBtn');
  const testBtn = document.getElementById('testBtn');
  const statusDiv = document.getElementById('status');

  const lossCanvas = document.getElementById('lossChart');
  const lossCtx = lossCanvas.getContext('2d');
  const projectionCanvas = document.getElementById('projectionCanvas');
  const projCtx = projectionCanvas.getContext('2d');

  let interactions = [];
  let items = new Map();
  let userToRated = new Map();
  let userId2idx = new Map(), idx2userId = [];
  let itemId2idx = new Map(), idx2itemId = [];
  let model;
  let embeddingDim = 32;

  function updateStatus(msg) { statusDiv.textContent = 'Status: ' + msg; }

  async function loadData() {
    updateStatus('Loading u.item...');
    const itemTxt = await fetch('data/u.item').then(r => r.text());
    itemTxt.split('\n').forEach(line => {
      if (!line) return;
      const parts = line.split('|');
      const itemId = parseInt(parts[0]);
      const title = parts[1];
      const yearMatch = title.match(/\((\d{4})\)$/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      items.set(itemId, { title, year });
    });

    updateStatus('Loading u.data...');
    const dataTxt = await fetch('data/u.data').then(r => r.text());
    dataTxt.split('\n').forEach(line => {
      if (!line) return;
      const [u, i, r] = line.split('\t');
      const userId = parseInt(u), itemId = parseInt(i), rating = parseFloat(r);
      interactions.push({ userId, itemId, rating });
      if (!userToRated.has(userId)) userToRated.set(userId, []);
      userToRated.get(userId).push({ itemId, rating });
    });

    // Build indices
    [...userToRated.keys()].forEach((uId, idx) => { userId2idx.set(uId, idx); idx2userId[idx] = uId; });
    [...items.keys()].forEach((iId, idx) => { itemId2idx.set(iId, idx); idx2itemId[idx] = iId; });

    updateStatus(`Loaded ${interactions.length} interactions, ${items.size} items, ${userToRated.size} users.`);
  }

  function drawLossChart(losses) {
    lossCtx.clearRect(0,0,lossCanvas.width,lossCanvas.height);
    lossCtx.beginPath();
    lossCtx.strokeStyle='red';
    const step = lossCanvas.width / losses.length;
    losses.forEach((l,i)=>{
      const y = lossCanvas.height - l*lossCanvas.height*5; 
      if(i===0) lossCtx.moveTo(0,y);
      else lossCtx.lineTo(i*step, y);
    });
    lossCtx.stroke();
  }

  function drawProjection(embMatrix, labels) {
    projCtx.clearRect(0,0,projectionCanvas.width,projectionCanvas.height);
    for(let i=0;i<embMatrix.length;i++){
      const x = (embMatrix[i][0]+1)/2*projectionCanvas.width;
      const y = (embMatrix[i][1]+1)/2*projectionCanvas.height;
      projCtx.fillStyle='blue';
      projCtx.beginPath();
      projCtx.arc(x,y,3,0,2*Math.PI);
      projCtx.fill();
      projCtx.fillStyle='black';
      projCtx.font='10px Arial';
      projCtx.fillText(labels[i], x+4, y+4);
    }
  }

  async function trainModel() {
    updateStatus('Training model...');
    const numUsers = userId2idx.size;
    const numItems = itemId2idx.size;
    model = new TwoTowerModel(numUsers, numItems, embeddingDim);

    const epochs = 3;
    const batchSize = 512;
    const losses = [];

    for (let epoch=0; epoch<epochs; epoch++){
      for(let i=0;i<interactions.length;i+=batchSize){
        const batch = interactions.slice(i,i+batchSize);
        const loss = await model.trainStep(batch, userId2idx, itemId2idx);
        losses.push(loss);
        drawLossChart(losses);
      }
      updateStatus(`Epoch ${epoch+1}/${epochs} done`);
    }

    // Draw sample embedding projection (first 500 items)
    const sampleIds = [...itemId2idx.values()].slice(0,500);
    const embMat = await model.getItemEmbeddings(sampleIds);
    const proj = simplePCA(embMat,2);
    const labels = sampleIds.map(idx => items.get(idx2itemId[idx]).title);
    drawProjection(proj, labels);

    updateStatus('Training complete.');
  }

  async function testModel() {
    updateStatus('Testing model...');
    // pick user with >=20 ratings
    const candidates = [...userToRated.entries()].filter(([u,l])=>l.length>=20);
    const [userId, rated] = candidates[Math.floor(Math.random()*candidates.length)];
    rated.sort((a,b)=>b.rating-a.rating);
    const top10Hist = rated.slice(0,10);

    // simple top-10 without DL
    const top10Simple = rated.slice().sort((a,b)=>b.rating-a.rating).slice(0,10);

    // top-10 with DL
    const uIdx = userId2idx.get(userId);
    const scores = await model.getScoresForAllItems(uIdx);
    const alreadyRated = new Set(rated.map(r=>r.itemId));
    const ranked = scores.map((s,i)=>({itemId: idx2itemId[i], score: s}))
                        .filter(o=>!alreadyRated.has(o.itemId))
                        .sort((a,b)=>b.score-a.score)
                        .slice(0,10);

    renderResults(top10Hist, top10Simple, ranked);
    updateStatus(`Test complete for user ${userId}`);
  }

  function renderResults(hist, simple, dl){
    const container = document.getElementById('results');
    container.innerHTML = '';
    const titles = ['Top-10 Historical','Top-10 Simple','Top-10 Two-Tower DL'];
    const lists = [hist,simple,dl];
    const tableHtml = lists.map((lst,idx)=>{
      return `<table>
        <tr><th colspan="4">${titles[idx]}</th></tr>
        <tr><th>Rank</th><th>Movie</th><th>Rating/Score</th><th>Year</th></tr>
        ${lst.map((r,i)=>`<tr><td>${i+1}</td><td>${items.get(r.itemId)?.title || ''}</td><td>${r.rating||r.score.toFixed(2)}</td><td>${items.get(r.itemId)?.year||''}</td></tr>`).join('')}
      </table>`;
    }).join('');
    container.innerHTML = tableHtml;
  }

  function simplePCA(matrix, k){
    // naive PCA approximation: just pick first 2 dims for demo
    return matrix.map(v=>v.slice(0,k));
  }

  loadDataBtn.addEventListener('click', loadData);
  trainBtn.addEventListener('click', trainModel);
  testBtn.addEventListener('click', testModel);
});
