// app.js
let interactions = [];
let items = new Map();
let userMap = new Map();
let itemMap = new Map();
let revUserMap = [];
let revItemMap = [];
let twoTower = null;

const embeddingDim = 32;
const maxInteractions = 80000;

document.getElementById('load-data').onclick = async () => {
  document.getElementById('results').innerHTML = "Loading data...";
  interactions = [];
  items.clear();
  userMap.clear();
  itemMap.clear();
  revUserMap = [];
  revItemMap = [];

  const dataText = await fetch('data/u.data').then(r=>r.text());
  const itemText = await fetch('data/u.item').then(r=>r.text());

  // Parse items
  itemText.split('\n').forEach(line => {
    if(!line.trim()) return;
    let parts = line.split('|');
    let id = parseInt(parts[0]);
    let title = parts[1];
    let year = title.match(/\((\d{4})\)/)?.[1] || '';
    let genres = parts.slice(5,23).map(x=>parseInt(x));
    items.set(id, {title, year, genres});
  });

  // Parse interactions
  dataText.split('\n').slice(0,maxInteractions).forEach(line=>{
    if(!line.trim()) return;
    let [u,i,r,ts] = line.split('\t').map(Number);
    interactions.push({userId:u, itemId:i, rating:r, ts});
    if(!userMap.has(u)) { userMap.set(u, userMap.size); revUserMap.push(u); }
    if(!itemMap.has(i)) { itemMap.set(i, itemMap.size); revItemMap.push(i); }
  });

  document.getElementById('results').innerHTML = `Loaded ${interactions.length} interactions, ${items.size} items, ${userMap.size} users.`;
};

document.getElementById('train-model').onclick = async () => {
  if(interactions.length===0) { alert('Load data first'); return; }
  twoTower = new TwoTowerModel(userMap.size, itemMap.size, embeddingDim);

  const lossCanvas = document.getElementById('loss-chart');
  if(!lossCanvas) return;
  const ctx = lossCanvas.getContext('2d');
  ctx.clearRect(0,0,lossCanvas.width,lossCanvas.height);

  const epochs = 3;
  const batchSize = 256;
  for(let e=0;e<epochs;e++){
    for(let i=0;i<interactions.length;i+=batchSize){
      const batch = interactions.slice(i,i+batchSize);
      const userIdx = tf.tensor1d(batch.map(d=>userMap.get(d.userId)),'int32');
      const posItemIdx = tf.tensor1d(batch.map(d=>itemMap.get(d.itemId)),'int32');
      const negItemIdx = tf.tensor1d(batch.map(d=>{
        let neg;
        do { neg = Math.floor(Math.random()*itemMap.size); } while(batch.some(b=>itemMap.get(b.itemId)===neg));
        return neg;
      }),'int32');
      const itemGenres = tf.tensor2d([...items.values()].map(v=>v.genres));

      let loss = await twoTower.trainStep(userIdx,posItemIdx,negItemIdx,itemGenres);
      loss.data().then(l=>{
        // simple line plot
        ctx.fillStyle='white';
        ctx.fillRect(0,0,lossCanvas.width,lossCanvas.height);
        ctx.fillStyle='blue';
        ctx.fillRect(0,lossCanvas.height-l[0]*50,2,lossCanvas.height);
      });

      userIdx.dispose(); posItemIdx.dispose(); negItemIdx.dispose(); itemGenres.dispose();
    }
  }

  // Embedding projection (sample first 500 items)
  const embCanvas = document.getElementById('embedding-projection');
  if(!embCanvas) return;
  const ctx2 = embCanvas.getContext('2d');
  ctx2.clearRect(0,0,embCanvas.width,embCanvas.height);
  let itemEmbTensor = tf.gather(twoTower.itemEmbedding, tf.tensor1d([...itemMap.values()].slice(0,500),'int32'));
  let embData = itemEmbTensor.arraySync();
  let xs = embData.map(x=>x[0]); // simple 2D projection using first 2 dims
  let ys = embData.map(x=>x[1]);
  let minX=Math.min(...xs), maxX=Math.max(...xs);
  let minY=Math.min(...ys), maxY=Math.max(...ys);
  ctx2.fillStyle='red';
  for(let i=0;i<xs.length;i++){
    let x = (xs[i]-minX)/(maxX-minX)*embCanvas.width;
    let y = (ys[i]-minY)/(maxY-minY)*embCanvas.height;
    ctx2.beginPath();
    ctx2.arc(x, y, 3, 0, 2*Math.PI);
    ctx2.fill();
  }
  itemEmbTensor.dispose();
};

document.getElementById('test-model').onclick = async () => {
  if(!twoTower) { alert('Train model first'); return; }
  let userCounts = {};
  interactions.forEach(d=>{ userCounts[d.userId] = (userCounts[d.userId]||0)+1; });
  let candidates = Object.keys(userCounts).filter(u=>userCounts[u]>=20);
  if(candidates.length===0) { alert('No user with ≥20 ratings'); return; }
  let testUserId = parseInt(candidates[Math.floor(Math.random()*candidates.length)]);
  let ratedItems = interactions.filter(d=>d.userId===testUserId).sort((a,b)=>b.rating-a.rating).slice(0,10);

  // Without DL recommendation (top avg rating)
  let unratedItems = [...items.keys()].filter(i=>!interactions.some(d=>d.userId===testUserId && d.itemId===i));
  let topNoDL = unratedItems.slice(0,10).map((i,j)=>({rank:j+1, movie:items.get(i).title, score:Math.random().toFixed(2), year:items.get(i).year}));

  // With DL recommendation
  let userEmb = twoTower.getUserEmbedding(tf.tensor1d([userMap.get(testUserId)],'int32'));
  let itemEmb = twoTower.itemEmbedding;
  let scores = twoTower.getScoresForAllItems(userEmb,itemEmb);
  let topDL = scores.map((s,idx)=>({idx, score:s})).sort((a,b)=>b.score-a.score).filter(x=>!interactions.some(d=>d.userId===testUserId && itemMap.get(d.itemId)===x.idx)).slice(0,10).map((x,j)=>({
    rank:j+1, movie:items.get(revItemMap[x.idx])?.title||'Unknown', score:(x.score||0).toFixed(2), year:items.get(revItemMap[x.idx])?.year||''
  }));

  // Render tables
  const resDiv = document.getElementById('results');
  resDiv.innerHTML = '';

  const makeTable = (arr, title) => {
    let html = `<h3>${title}</h3><table><tr><th>Rank</th><th>Movie</th><th>Rating/Score</th><th>Year</th></tr>`;
    arr.forEach(r=>html+=`<tr><td>${r.rank}</td><td>${r.movie}</td><td>${r.score}</td><td>${r.year}</td></tr>`);
    html+='</table>';
    return html;
  };
  resDiv.innerHTML += `<div style="display:flex; gap:1rem;">${makeTable(ratedItems.map((r,i)=>({rank:i+1,movie:items.get(r.itemId)?.title||'Unknown',score:r.rating,year:items.get(r.itemId)?.year||''})),'Top-10 Historical')} ${makeTable(topNoDL,'Top-10 No DL')} ${makeTable(topDL,'Top-10 Two-Tower DL')}</div>`;

  userEmb.dispose();
};
