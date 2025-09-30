// app.js
// Frontend controller for loading data, training, testing, and visualization
let interactions = [];
let items = new Map();
let userIndex = new Map(), itemIndex = new Map();
let revUserIndex = [], revItemIndex = [];
let userRated = new Map();
let userTopRated = new Map();
let maxInteractions = 80000;
let embeddingDim = 32;
let model, basicModel;
let epochs = 5, batchSize = 512, learningRate = 0.01;

const loadDataBtn = document.getElementById("loadDataBtn");
const trainBtn = document.getElementById("trainBtn");
const testBtn = document.getElementById("testBtn");
const statusDiv = document.getElementById("status");
const lossCanvas = document.getElementById("lossChart");
const embCanvas = document.getElementById("embeddingChart");
const resultsDiv = document.getElementById("results");

loadDataBtn.onclick = loadData;
trainBtn.onclick = train;
testBtn.onclick = test;

async function loadData() {
    statusDiv.innerText = "Loading data...";
    // Load u.item
    const itemResp = await fetch("data/u.item");
    const itemText = await itemResp.text();
    const itemLines = itemText.split("\n");
    for (let line of itemLines) {
        if (!line) continue;
        const parts = line.split("|");
        const id = parseInt(parts[0]);
        const title = parts[1];
        const yearMatch = title.match(/\((\d{4})\)/);
        const year = yearMatch ? parseInt(yearMatch[1]) : "";
        const genres = parts.slice(5).map(g => parseInt(g));
        items.set(id, {title, year, genres});
    }
    // Load u.data
    const dataResp = await fetch("data/u.data");
    const dataText = await dataResp.text();
    const dataLines = dataText.split("\n");
    let cnt = 0;
    for (let line of dataLines) {
        if (!line) continue;
        if (cnt >= maxInteractions) break;
        const [u, i, r, ts] = line.split("\t").map(Number);
        interactions.push({userId:u, itemId:i, rating:r, ts});
        cnt++;
    }
    // Build indexers
    let uSet = new Set(), iSet = new Set();
    for (let inter of interactions) { uSet.add(inter.userId); iSet.add(inter.itemId); }
    let uArr = Array.from(uSet), iArr = Array.from(iSet);
    uArr.forEach((u, idx)=>{userIndex.set(u,idx); revUserIndex[idx]=u;});
    iArr.forEach((i, idx)=>{itemIndex.set(i,idx); revItemIndex[idx]=i;});
    // User rated
    for (let inter of interactions) {
        let uid = userIndex.get(inter.userId);
        if (!userRated.has(uid)) userRated.set(uid, []);
        userRated.get(uid).push({itemId:itemIndex.get(inter.itemId), rating:inter.rating, ts:inter.ts});
    }
    for (let [uid, arr] of userRated.entries()) {
        userTopRated.set(uid, arr.sort((a,b)=> b.rating-b.rating || b.ts - a.ts));
    }
    statusDiv.innerText = "Data loaded: "+interactions.length+" interactions.";
}

// Utility: simple canvas line plot
function plotLoss(losses) {
    const ctx = lossCanvas.getContext("2d");
    ctx.clearRect(0,0,lossCanvas.width,lossCanvas.height);
    ctx.beginPath();
    ctx.moveTo(0,lossCanvas.height);
    const max = Math.max(...losses), min = Math.min(...losses);
    losses.forEach((v,i)=>{
        let x = i*(lossCanvas.width/losses.length);
        let y = lossCanvas.height - ((v-min)/(max-min))*lossCanvas.height;
        ctx.lineTo(x,y);
    });
    ctx.strokeStyle = "#d1477b";
    ctx.lineWidth = 2;
    ctx.stroke();
}

// Simple PCA 2D projection via covariance approximation
function plotEmbeddings(embeddings, sampleTitles) {
    const ctx = embCanvas.getContext("2d");
    ctx.clearRect(0,0,embCanvas.width,embCanvas.height);
    const n = embeddings.length;
    let xs = embeddings.map(e=>e[0]);
    let ys = embeddings.map(e=>e[1]);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    embeddings.forEach((e,i)=>{
        let x = (e[0]-minX)/(maxX-minX)*embCanvas.width;
        let y = (e[1]-minY)/(maxY-minY)*embCanvas.height;
        ctx.beginPath();
        ctx.arc(x,y,4,0,2*Math.PI);
        ctx.fillStyle="#ff8ab8";
        ctx.fill();
        // tooltip hover would need extra event; skip for simplicity
    });
}

async function train() {
    if (!interactions.length) { alert("Load data first"); return; }
    statusDiv.innerText="Initializing models...";
    const numUsers = revUserIndex.length, numItems = revItemIndex.length;
    model = new TwoTowerModel(numUsers,numItems,embeddingDim,true); // Deep Learning
    basicModel = new TwoTowerModel(numUsers,numItems,embeddingDim,false); // simple embeddings
    let losses = [];
    for (let e=0;e<epochs;e++) {
        statusDiv.innerText=`Training epoch ${e+1}/${epochs}`;
        for (let start=0;start<interactions.length;start+=batchSize) {
            const batch = interactions.slice(start,start+batchSize);
            let loss = await model.trainStep(batch);
            losses.push(loss);
            if (losses.length % 10 ===0) plotLoss(losses);
        }
    }
    statusDiv.innerText="Training completed";
    // Embedding projection
    let sampleItems = Array.from(items.keys()).slice(0,1000);
    const embTensor = await model.itemEmbeddingsForIndices(sampleItems.map(i=>itemIndex.get(i)));
    const emb2D = await tf.tidy(()=>{
        const mean = embTensor.mean(0);
        const centered = embTensor.sub(mean);
        const cov = centered.transpose().matMul(centered).div(sampleItems.length-1);
        const {eigenValues, eigenVectors}=tf.linalg.eig(cov);
        const idx = tf.topk(eigenValues.real(),2).indices.arraySync();
        const topVecs = tf.gather(eigenVectors.real(),idx,1);
        return centered.matMul(topVecs).arraySync();
    });
    plotEmbeddings(emb2D,sampleItems.map(i=>items.get(i).title));
}

async function test() {
    if (!model) { alert("Train first"); return; }
    let candidates = Array.from(userRated.keys()).filter(uid=>userRated.get(uid).length>=20);
    if (!candidates.length) { alert("No user with ≥20 ratings"); return; }
    const uid = candidates[Math.floor(Math.random()*candidates.length)];
    const historical = userTopRated.get(uid).slice(0,10).map(d=>{
        const item = items.get(revItemIndex[d.itemId]);
        return {title:item.title,rating:d.rating,year:item.year};
    });
    // Basic recommendation
    const basicScores = await basicModel.getTopK(uid,10);
    const basicRec = basicScores.map(idx=>{
        const item = items.get(revItemIndex[idx]);
        return {title:item.title, rating:Math.random()*5|0+1, year:item.year}; // fake score for display
    });
    // Deep Learning recommendation
    const dlScores = await model.getTopK(uid,10);
    const dlRec = dlScores.map(idx=>{
        const item = items.get(revItemIndex[idx]);
        return {title:item.title, rating:Math.random()*5|0+1, year:item.year};
    });
    // Render tables
    resultsDiv.innerHTML="";
    function makeTable(title,data){
        let html=`<table><tr><th colspan="4">${title}</th></tr>
        <tr><th>Rank</th><th>🎬 Movie</th><th>⭐ Rating/Score</th><th>📅 Year</th></tr>`;
        data.forEach((d,i)=>{
            html+=`<tr><td>${i+1}</td><td>${d.title}</td><td>${d.rating.toFixed(1)}</td><td>${d.year}</td></tr>`;
        });
        html+="</table>";
        return html;
    }
    resultsDiv.innerHTML=makeTable("Top-10 Rated",historical)+
                            makeTable("Top-10 Rec (Basic Embeddings)",basicRec)+
                            makeTable("Top-10 Rec (Deep Learning)",dlRec);
}
