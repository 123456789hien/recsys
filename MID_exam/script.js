window.onload = async function() {
    const loaded = await loadData();
    if(!loaded) return alert('Failed to load CSV data');

    initLocationButtons();

    document.getElementById('download-embeddings').onclick = downloadEmbeddingsTemplate;

    document.getElementById('upload-embeddings').onchange = async function(e){
        await loadEmbeddingsFile(e.target.files[0]);
        document.getElementById('embedding-note').innerText = '✅ Embeddings uploaded successfully';
    };

    document.getElementById('compute-recs').onclick = computeTopN;
}

// --- Location & User UI ---
function initLocationButtons() {
    const locs = Array.from(new Set(users.map(u=>u.location)));
    const container = document.getElementById('location-buttons');
    container.innerHTML = '';
    ['All', ...locs].forEach(loc=>{
        const btn = document.createElement('button');
        btn.innerText = loc;
        btn.onclick = ()=>selectLocation(loc);
        container.appendChild(btn);
    });
    document.getElementById('location-note').innerText = '✅ Locations loaded';
}

function selectLocation(loc) {
    const filtered = filterUsersByLocation(loc);
    const sel = document.getElementById('user-select');
    sel.innerHTML = '<option value="">Select User ID</option>';
    filtered.forEach(u=>{
        const opt = document.createElement('option');
        opt.value = u.user_id;
        opt.innerText = u.user_id;
        sel.appendChild(opt);
    });
    document.getElementById('user-note').innerText = `✅ Users in location: ${loc}`;
    sel.onchange = ()=>showHistory(sel.value);
}

// --- History ---
function showHistory(userId) {
    const hist = getUserHistory(userId);
    const tbody = document.querySelector('#history-table tbody');
    tbody.innerHTML = '';
    hist.forEach(h=>{
        const item = items.find(it=>it.item_id===h.item_id);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item?item.name:h.item_id}</td>
                        <td>${item?parseFloat(item.price).toFixed(2):'N/A'}</td>
                        <td>${h.rating}</td>
                        <td>${h.timestamp}</td>`;
        tbody.appendChild(tr);
    });
    updateEDACharts(userId);
}

// --- Top-N Recommendations ---
function computeTopN() {
    const userId = document.getElementById('user-select').value;
    if(!userId) return alert('Select a user first');
    if(!embeddings || Object.keys(embeddings).length===0) return alert('Upload embeddings first');
    document.getElementById('recs-note').innerText = '🔄 Computing recommendations...';

    const userHist = getUserHistory(userId);
    const purchasedIds = userHist.map(i=>i.item_id);
    const userVec = Array(16).fill(0);
    userHist.forEach(i=>{
        const vec = embeddings[i.item_id];
        if(vec) vec.forEach((v,j)=>userVec[j]+=parseFloat(v));
    });

    const recs = items.filter(it=>!purchasedIds.includes(it.item_id)).map(it=>{
        const itemVec = embeddings[it.item_id] || Array(16).fill(0);
        const sim = cosineSim(userVec, itemVec);
        const rating = interactions.filter(inter=>inter.item_id===it.item_id)
                                  .reduce((a,b)=>a+parseFloat(b.rating),0) /
                       Math.max(1, interactions.filter(inter=>inter.item_id===it.item_id).length);
        const price = parseFloat(it.price);
        const score = sim*0.5 + rating*0.3 + (1/Math.max(price,1))*0.2;
        return {...it, sim, rating, score};
    });

    renderTopN('Best Value', recs.sort((a,b)=>b.score-a.score).slice(0,10));
    renderTopN('Highest Rated', recs.sort((a,b)=>b.rating-a.rating).slice(0,10));
    renderTopN('Most Similar', recs.sort((a,b)=>b.sim-a.sim).slice(0,10));

    document.getElementById('recs-note').innerText = '✅ Recommendations computed';
}

function cosineSim(a,b){
    let dot=0,normA=0,normB=0;
    for(let i=0;i<a.length;i++){
        dot += a[i]*b[i];
        normA += a[i]*a[i];
        normB += b[i]*b[i];
    }
    return normA&&normB?dot/Math.sqrt(normA*normB):0;
}

function renderTopN(column,data){
    const container = Array.from(document.querySelectorAll('.rec-column')).find(c=>c.querySelector('h3').innerText===column);
    const tbody = container.querySelector('tbody');
    tbody.innerHTML = '';
    data.forEach(it=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${it.name}</td><td>${parseFloat(it.price).toFixed(2)}</td><td>${it.rating.toFixed(1)}</td>`;
        tbody.appendChild(tr);
    });
}

// --- EDA Charts ---
let priceChart,ratingChart;
function updateEDACharts(userId){
    const hist = getUserHistory(userId).map(h=>{
        const item = items.find(it=>it.item_id===h.item_id);
        return {price: parseFloat(item?item.price:0), rating: parseFloat(h.rating)};
    });

    const prices = hist.map(h=>h.price);
    const ratings = hist.map(h=>h.rating);

    if(priceChart) priceChart.destroy();
    priceChart = new Chart(document.getElementById('price-chart'), {
        type: 'bar',
        data: {labels: prices.map((_,i)=>i+1), datasets:[{label:'Price', data:prices, backgroundColor:'#d63384'}]},
        options:{responsive:true, plugins:{legend:{display:false}}}
    });

    if(ratingChart) ratingChart.destroy();
    ratingChart = new Chart(document.getElementById('rating-chart'), {
        type: 'bar',
        data: {labels: ratings.map((_,i)=>i+1), datasets:[{label:'Rating', data:ratings, backgroundColor:'#ff66a3'}]},
        options:{responsive:true, plugins:{legend:{display:false}}}
    });
}
