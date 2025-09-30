// app.js
// ---------- Global Variables ----------
let interactions=[],itemsMap=new Map();
let user2idx=new Map(),idx2user=[],item2idx=new Map(),idx2item=[];
let userRated=new Map();
let model;
const cfg={embeddingDim:32,epochs:3,batchSize:512,learningRate:0.005,maxInteractions:80000};
let itemEmbMatrix;

// ---------- UI Elements ----------
const statusEl=document.getElementById('status');
const lossCanvas=document.getElementById('lossChart');
const projCanvas=document.getElementById('projChart');
const resultsDiv=document.getElementById('results');

// ---------- Helpers ----------
function logStatus(msg){statusEl.textContent=msg;}
function drawLoss(losses){
  const ctx=lossCanvas.getContext('2d');
  ctx.clearRect(0,0,lossCanvas.width,lossCanvas.height);
  ctx.beginPath();ctx.moveTo(0,lossCanvas.height-5);
  const maxL=Math.max(...losses);
  losses.forEach((l,i)=>{
    const x=i*lossCanvas.width/(losses.length-1);
    const y=lossCanvas.height-(l/maxL)*(lossCanvas.height-10);
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });
  ctx.strokeStyle='blue';ctx.stroke();
  ctx.fillText('Loss',5,10);
}
function pca2D(mat){ // simple mean-centered SVD approximation using tf.svd
  return tf.tidy(()=>{
    const X=mat.sub(mat.mean(0));
    const {u,s,v}=tf.linalg.svd(X);
    return u.slice([0,0],[X.shape[0],2]).mul(s.slice([0],[2]));
  });
}
function drawProjection(points,titles){
  const ctx=projCanvas.getContext('2d');
  ctx.clearRect(0,0,projCanvas.width,projCanvas.height);
  const xs=points.slice([], [points.shape[0],1]).arraySync().flat();
  const ys=points.slice([0,1], [points.shape[0],1]).arraySync().flat();
  const minX=Math.min(...xs),maxX=Math.max(...xs);
  const minY=Math.min(...ys),maxY=Math.max(...ys);
  for(let i=0;i<xs.length;i++){
    const x=(xs[i]-minX)/(maxX-minX)*projCanvas.width;
    const y=(ys[i]-minY)/(maxY-minY)*projCanvas.height;
    ctx.fillStyle='rgba(0,0,200,0.6)';
    ctx.fillRect(x,y,2,2);
  }
}

// ---------- Data Loading ----------
async function loadData(){
  logStatus('Loading data...');
  const ud=await fetch('data/u.data').then(r=>r.text());
  const ui=await fetch('data/u.item').then(r=>r.text());
  const lines=ud.trim().split('\n').slice(0,cfg.maxInteractions);
  for(const ln of lines){
    const [u,i,r,t]=ln.trim().split('\t');
    interactions.push({userId:+u,itemId:+i,rating:+r,ts:+t});
  }
  const ilines=ui.trim().split('\n');
  for(const ln of ilines){
    const parts=ln.split('|');
    const id=+parts[0];
    const title=parts[1];
    let year=null;
    const m=title.match(/\((\d{4})\)/);
    if(m)year=+m[1];
    itemsMap.set(id,{title,year});
  }
  // indexers
  const users=[...new Set(interactions.map(x=>x.userId))];
  users.forEach((u,idx)=>{user2idx.set(u,idx);idx2user[idx]=u;});
  const items=[...itemsMap.keys()];
  items.forEach((i,idx)=>{item2idx.set(i,idx);idx2item[idx]=i;});
  // userRated
  for(const {userId,itemId,rating,ts} of interactions){
    if(!userRated.has(userId))userRated.set(userId,[]);
    userRated.get(userId).push({itemId,rating,ts});
  }
  logStatus(`Loaded ${interactions.length} interactions, ${users.length} users, ${items.length} items.`);
}

// ---------- Training ----------
async function train(){
  model=new TwoTowerModel(user2idx.size,item2idx.size,cfg.embeddingDim);
  const opt=tf.train.adam(cfg.learningRate);
  const losses=[];
  const data=interactions.map(d=>({u:user2idx.get(d.userId),i:item2idx.get(d.itemId)}));
  for(let ep=0;ep<cfg.epochs;ep++){
    logStatus(`Epoch ${ep+1}/${cfg.epochs}`);
    tf.util.shuffle(data);
    for(let b=0;b<data.length; b+=cfg.batchSize){
      const batch=data.slice(b,b+cfg.batchSize);
      const u=tf.tensor1d(batch.map(x=>x.u),'int32');
      const i=tf.tensor1d(batch.map(x=>x.i),'int32');
      const loss=model.trainStep(u,i,opt);
      losses.push(loss.dataSync()[0]);
      if(b%2000===0)drawLoss(losses);
      u.dispose();i.dispose();loss.dispose();
      await tf.nextFrame();
    }
  }
  logStatus('Training done. Computing projection...');
  itemEmbMatrix=model.getAllItemEmbeddings();
  const sampleIdxs=tf.range(0,Math.min(1000,itemEmbMatrix.shape[0]),1,'int32');
  const sampleEmb=tf.gather(itemEmbMatrix,sampleIdxs);
  const proj=pca2D(sampleEmb);
  drawProjection(proj,[]);
  proj.dispose();sampleEmb.dispose();sampleIdxs.dispose();
  logStatus('Training completed.');
}

// ---------- Testing ----------
function getTopHistorical(userId){
  const arr=userRated.get(userId) || [];
  return arr.sort((a,b)=>b.rating!==a.rating?b.rating-a.rating:b.ts-a.ts).slice(0,10)
    .map((x,idx)=>({rank:idx+1,title:itemsMap.get(x.itemId).title,rating:x.rating,year:itemsMap.get(x.itemId).year||''}));
}
function getTopBaseline(uIdx){
  // baseline: dot with itemBase only
  const uEmb=model.getUserBase(uIdx);
  const scores=uEmb.dot(itemEmbMatrix.transpose()).arraySync();
  const rated=new Set((userRated.get(idx2user[uIdx])||[]).map(x=>x.itemId));
  const arr=[];
  scores.forEach((s,i)=>{ if(!rated.has(idx2item[i])) arr.push({i,score:s}); });
  arr.sort((a,b)=>b.score-a.score);
  return arr.slice(0,10).map((x,j)=>({rank:j+1,title:itemsMap.get(idx2item[x.i]).title,score:x.score.toFixed(3),year:itemsMap.get(idx2item[x.i]).year||''}));
}
function getTopDL(uIdx){
  const uEmb=model.getUserEmbedding(uIdx);
  const scores=uEmb.dot(itemEmbMatrix.transpose()).arraySync();
  const rated=new Set((userRated.get(idx2user[uIdx])||[]).map(x=>x.itemId));
  const arr=[];
  scores.forEach((s,i)=>{ if(!rated.has(idx2item[i])) arr.push({i,score:s}); });
  arr.sort((a,b)=>b.score-a.score);
  return arr.slice(0,10).map((x,j)=>({rank:j+1,title:itemsMap.get(idx2item[x.i]).title,score:x.score.toFixed(3),year:itemsMap.get(idx2item[x.i]).year||''}));
}
function renderTable(title,rows,isHist=false){
  let html=`<table><thead><tr><th colspan="4">${title}</th></tr><tr><th>Rank</th><th>Movie</th><th>${isHist?'Rating':'Score'}</th><th>Year</th></tr></thead><tbody>`;
  for(const r of rows){
    html+=`<tr><td>${r.rank}</td><td>${r.title}</td><td>${isHist?r.rating:r.score}</td><td>${r.year||''}</td></tr>`;
  }
  html+='</tbody></table>';
  return html;
}
function test(){
  // pick random user with >=20 ratings
  const qualified=[...userRated.keys()].filter(u=>userRated.get(u).length>=20);
  const userId=qualified[Math.floor(Math.random()*qualified.length)];
  const uIdx=user2idx.get(userId);
  const hist=getTopHistorical(userId);
  const base=getTopBaseline(uIdx);
  const dl=getTopDL(uIdx);
  resultsDiv.innerHTML=`<div style="display:flex;gap:20px;flex-wrap:wrap;">${renderTable('Historical Top-10',hist,true)}${renderTable('Baseline Top-10',base)}${renderTable('Two-Tower DL Top-10',dl)}</div>`;
  logStatus(`Tested on user ${userId}`);
}

// ---------- Event Listeners ----------
document.getElementById('loadBtn').onclick=loadData;
document.getElementById('trainBtn').onclick=train;
document.getElementById('testBtn').onclick=test;
