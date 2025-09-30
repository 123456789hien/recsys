// app.js
let interactions=[], items=new Map();
let userToItems=new Map(), userTopRated=new Map();
let userIndex=new Map(), itemIndex=new Map();
let revUserIndex=[], revItemIndex=[];
let baselineModel=null, deepModel=null;
let embeddingDim=32, batchSize=128, epochs=5, maxInteractions=80000;
let statusEl=document.getElementById('status');
let chartCanvas=document.getElementById('chart');
let compareCanvas=document.getElementById('compareChart');
let embCanvas=document.getElementById('embeddingCanvas');

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
            items.set(id,{title,year,avgRating:0, count:0});
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

        // compute avgRating for baseline
        items.forEach((v,k)=>{ v.avgRating=0; v.count=0; });
        interactions.forEach(d=>{
            const it=items.get(d.itemId);
            it.avgRating+=d.rating; it.count+=1;
        });
        items.forEach(v=>{ if(v.count>0) v.avgRating/=v.count; });

        statusEl.textContent=`Loaded ${interactions.length} interactions, ${uSet.size} users, ${iSet.size} items.`;
        baselineModel=new TwoTowerModel(uSet.size,iSet.size,embeddingDim,false);
        deepModel=new TwoTowerModel(uSet.size,iSet.size,embeddingDim,true);

    }catch(err){ statusEl.textContent='Error loading data: '+err.message; console.error(err);}
}

async function trainModels(){
    if(!baselineModel||!deepModel){ statusEl.textContent='Load data first'; return; }
    statusEl.textContent='Training baseline and deep models...';
    let baselineLosses=[], deepLosses=[];
    for(let e=0;e<epochs;e++){
        for(let b=0;b<interactions.length;b+=batchSize){
            const batch=interactions.slice(b,b+batchSize);
            if(batch.length===0) continue;
            const userIdx=batch.map(d=>userIndex.get(d.userId));
            const posIdx=batch.map(d=>itemIndex.get(d.itemId));
            const lossBase=await baselineModel.trainStep(userIdx,posIdx);
            const lossDeep=await deepModel.trainStep(userIdx,posIdx);
            baselineLosses.push(lossBase.dataSync()[0]);
            deepLosses.push(lossDeep.dataSync()[0]);
        }
        statusEl.textContent=`Epoch ${e+1}/${epochs}, Baseline Loss: ${baselineLosses[baselineLosses.length-1].toFixed(4)}, Deep Loss: ${deepLosses[deepLosses.length-1].toFixed(4)}`;
        drawComparisonChart(baselineLosses,deepLosses);
        await tf.nextFrame();
    }
    statusEl.textContent='Training complete. Drawing embedding projection...';
    drawEmbeddingProjection();
}

function drawComparisonChart(baseLosses, deepLosses){
    const ctx=compareCanvas.getContext('2d');
    ctx.clearRect(0,0,compareCanvas.width,compareCanvas.height);
    const maxLoss=Math.max(...baseLosses,...deepLosses);
    ctx.lineWidth=2;
    ctx.strokeStyle='#ff99c8';
    ctx.beginPath();
    baseLosses.forEach((l,i)=>{
        const x=i*(compareCanvas.width/baseLosses.length);
        const y=compareCanvas.height-(l/maxLoss)*compareCanvas.height;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.strokeStyle='#ff4d94';
    ctx.beginPath();
    deepLosses.forEach((l,i)=>{
        const x=i*(compareCanvas.width/deepLosses.length);
        const y=compareCanvas.height-(l/maxLoss)*compareCanvas.height;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
}

function drawEmbeddingProjection(){
    const ctx=embCanvas.getContext('2d');
    ctx.clearRect(0,0,embCanvas.width,embCanvas.height);
    const sampleSize=Math.min(1000,revItemIndex.length);
    const sampleIdx=tf.util.createShuffledIndices(revItemIndex.length).slice(0,sampleSize);
    const embTensor=tf.gather(deepModel.itemEmbedding,sampleIdx);
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
    if(!deepModel){ statusEl.textContent='Load and train model first'; return; }
    const eligibleUsers=Array.from(userTopRated.keys()).filter(u=>userTopRated.get(u).length>=20);
    const userId=eligibleUsers[Math.floor(Math.random()*eligibleUsers.length)];
    const topRated=userTopRated.get(userId).slice(0,10).map(d=>items.get(d.itemId).title);

    // Deep model recommendations
    const uIdx=[userIndex.get(userId)];
    const uEmb=deepModel.getUserEmbedding(uIdx);
    const scores=deepModel.getScoresForAllItems(uEmb);
    const alreadyRated=new Set(userToItems.get(userId).map(d=>itemIndex.get(d.itemId)));
    let recs=[];
    scores.arraySync().forEach((s,i)=>{ if(!alreadyRated.has(i)) recs.push({i,s}); });
    recs.sort((a,b)=>b.s-a.s); recs=recs.slice(0,10).map(d=>items.get(revItemIndex[d.i]).title);

    // render side-by-side
    const resultsDiv=document.getElementById('results');
    resultsDiv.innerHTML='';
    const tableHTML=(titles,header)=>`<table><tr><th>${header}</th></tr>`+titles.map(t=>`<tr><td>${t}</td></tr>`).join('')+'</table>';
    resultsDiv.innerHTML=tableHTML(topRated,'Top-10 Rated Movie') + tableHTML(recs,'Top-10 Recommended Movie');
}

document.getElementById('loadBtn').addEventListener('click',loadData);
document.getElementById('trainBtn').addEventListener('click',trainModels);
document.getElementById('testBtn').addEventListener('click',testModel);
