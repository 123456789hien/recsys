// app.js
let interactions=[], items=new Map();
let userToItems=new Map(), userTopRated=new Map();
let userIndex=new Map(), itemIndex=new Map();
let revUserIndex=[], revItemIndex=[];
let model=null;
let embeddingDim=32, batchSize=128, epochs=5, maxInteractions=80000;
let statusEl=document.getElementById('status');
let chartCanvas=document.getElementById('chart');
let embCanvas=document.getElementById('embeddingCanvas');
let compareCanvas=document.getElementById('compareChart');

async function loadData(){
    statusEl.textContent='Loading data files...';
    try{
        const dataResp=await fetch('data/u.data');
        const itemResp=await fetch('data/u.item');
        if(!dataResp.ok || !itemResp.ok) throw new Error('Missing data files under /data/. Place u.data and u.item there.');
        const dataTxt=await dataResp.text();
        const itemTxt=await itemResp.text();

        items.clear();
        itemTxt.split('\n').forEach(line=>{
            const parts=line.split('|');
            if(parts.length<2) return;
            const id=parts[0].trim();
            let title=parts[1].trim(), year=null;
            const match=title.match(/\((\d{4})\)$/);
            if(match){ year=parseInt(match[1]); title=title.replace(/\(\d{4}\)$/,'').trim(); }
            items.set(id,{title,year});
        });

        interactions=dataTxt.split('\n').map(l=>{
            const p=l.split('\t');
            if(p.length<3) return null;
            return {userId:p[0].trim(), itemId:p[1].trim(), rating:+p[2], ts:+p[3]};
        }).filter(x=>x!=null);
        interactions=interactions.slice(0,maxInteractions);

        let uSet=new Set(), iSet=new Set();
        interactions.forEach(d=>{ uSet.add(d.userId); iSet.add(d.itemId); });
        Array.from(uSet).forEach((u,i)=>{userIndex.set(u,i); revUserIndex[i]=u;});
        Array.from(iSet).forEach((i,j)=>{itemIndex.set(i,j); revItemIndex[j]=i;});

        userToItems.clear(); userTopRated.clear();
        interactions.forEach(d=>{
            const u=d.userId;
            if(!userToItems.has(u)) userToItems.set(u,[]);
            userToItems.get(u).push(d);
        });
        userToItems.forEach((arr,u)=>{
            userTopRated.set(u, arr.slice().sort((a,b)=>b.rating - a.rating || b.ts - a.ts));
        });

        statusEl.textContent=`Loaded ${interactions.length} interactions, ${uSet.size} users, ${iSet.size} items.`;
        model=new TwoTowerModel(uSet.size,iSet.size,embeddingDim);

        // Baseline: average rating per movie
        interactions.forEach(d=>{
            if(!items.get(d.itemId).avg) items.get(d.itemId).avg=[]; 
            items.get(d.itemId).avg.push(d.rating);
        });
        items.forEach((v,k)=>{ v.avgRating = v.avg.reduce((a,b)=>a+b,0)/v.avg.length; });
    }catch(err){ statusEl.textContent='Error loading data: '+err.message; console.error(err);}
}

async function trainModel(){
    if(!model){ statusEl.textContent='Load data first'; return; }
    statusEl.textContent='Training Two-Tower model...';
    let losses=[];
    for(let e=0;e<epochs;e++){
        for(let b=0;b<interactions.length;b+=batchSize){
            const batch=interactions.slice(b,b+batchSize);
            if(batch.length===0) continue;
            const userIdx=batch.map(d=>userIndex.get(d.userId));
            const posIdx=batch.map(d=>itemIndex.get(d.itemId));
            const lossVal=await model.trainStep(userIdx,posIdx);
            losses.push(lossVal.dataSync()[0]);
        }
        statusEl.textContent=`Epoch ${e+1}/${epochs}, Latest Loss: ${losses[losses.length-1].toFixed(4)}`;
        drawChart(losses);
        await tf.nextFrame();
    }
    statusEl.textContent='Training complete. Drawing embedding projection...';
    drawEmbeddingProjection();
}

function drawChart(losses){
    const ctx=chartCanvas.getContext('2d');
    ctx.clearRect(0,0,chartCanvas.width,chartCanvas.height);
    ctx.strokeStyle='#ff4d94'; ctx.lineWidth=2;
    ctx.beginPath();
    losses.forEach((l,i)=>{
        const x=i*(chartCanvas.width/losses.length);
        const y=chartCanvas.height-(l*chartCanvas.height/Math.max(...losses));
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
}

function drawEmbeddingProjection(){
    const ctx=embCanvas.getContext('2d');
    ctx.clearRect(0,0,embCanvas.width,embCanvas.height);
    const sampleSize=Math.min(1000,revItemIndex.length);
    const sampleIdx=tf.util.createShuffledIndices(revItemIndex.length).slice(0,sampleSize);
    const embTensor=tf.gather(model.itemEmbedding,sampleIdx);
    const centered=embTensor.sub(embTensor.mean(0));
    const cov=tf.matMul(centered.transpose(),centered);
    const {eigVals,eigVecs}=tf.linalg.eigh(cov);
    const comp=tf.matMul(centered,eigVecs.slice([0,eigVecs.shape[1]-2],[eigVecs.shape[0],2]));
    const compData=comp.arraySync();
    ctx.fillStyle='#ff4d94';
    compData.forEach((v,i)=>{
        const x=(v[0]-Math.min(...compData.map(a=>a[0])))/(Math.max(...compData.map(a=>a[0]))-Math.min(...compData.map(a=>a[0])))*embCanvas.width;
        const y=(v[1]-Math.min(...compData.map(a=>a[1])))/(Math.max(...compData.map(a=>a[1]))-Math.min(...compData.map(a=>a[1])))*embCanvas.height;
        ctx.beginPath(); ctx.arc(x,embCanvas.height-y,3,0,2*Math.PI); ctx.fill();
    });
}

function testModel(){
    if(!model){ statusEl.textContent='Load and train model first'; return; }
    const eligibleUsers=Array.from(userTopRated.keys()).filter(u=>userTopRated.get(u).length>=20);
    const userId=eligibleUsers[Math.floor(Math.random()*eligibleUsers.length)];
    const topRated=userTopRated.get(userId).slice(0,10).map(d=>items.get(d.itemId).title);

    // DL recommendations
    const uIdx=[userIndex.get(userId)];
    const uEmb=model.getUserEmbedding(uIdx);
    const scores=model.getScoresForAllItems(uEmb);
    const alreadyRated=new Set(userToItems.get(userId).map(d=>itemIndex.get(d.itemId)));
    let recs=[];
    scores.arraySync().forEach((s,i)=>{ if(!alreadyRated.has(i)) recs.push({i,s}); });
    recs.sort((a,b)=>b.s-a.s); recs=recs.slice(0,10).map(d=>items.get(revItemIndex[d.i]).title);

    // Baseline top-10
    const baseline=Array.from(items.values()).filter(i=>!alreadyRated.has(i)).sort((a,b)=>b.avgRating-a.avgRating).slice(0,10).map(i=>i.title);

    // render side-by-side
    const resultsDiv=document.getElementById('results');
    resultsDiv.innerHTML='';
    const tableHTML=(titles,header)=>`<table><tr><th>${header}</th></tr>`+titles.map(t=>`<tr><td>${t}</td></tr>`).join('')+'</table>';
    resultsDiv.innerHTML=tableHTML(topRated,'Top-10 Rated') + tableHTML(baseline,'Baseline (No DL)') + tableHTML(recs,'DL Recommended');

    drawComparisonChart(baseline,recs);
}

function drawComparisonChart(baseline,dl){
    const ctx=compareCanvas.getContext('2d');
    ctx.clearRect(0,0,compareCanvas.width,compareCanvas.height);
    const overlap=baseline.filter(t=>dl.includes(t)).length;
    const percent=overlap/baseline.length;
    ctx.fillStyle='#ffb3d9';
    ctx.fillRect(100,compareCanvas.height/2-50,200,100);
    ctx.fillStyle='#ff4d94';
    ctx.fillRect(100,compareCanvas.height/2-50,200*percent,100);
    ctx.fillStyle='#333'; ctx.font='16px sans-serif';
    ctx.fillText(`Overlap: ${overlap}/10`, 180, compareCanvas.height/2+6);
}

document.getElementById('loadBtn').addEventListener('click',loadData);
document.getElementById('trainBtn').addEventListener('click',trainModel);
document.getElementById('testBtn').addEventListener('click',testModel);
