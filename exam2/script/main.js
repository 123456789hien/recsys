let users = [], items = [], interactions = [], recommendations = [];

async function loadCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            dynamicTyping: true,
            complete: results => resolve(results.data),
            error: err => reject(err)
        });
    });
}

async function loadData() {
    users = await loadCSV("data/processed/users_clean.csv");
    items = await loadCSV("data/processed/items_clean.csv");
    interactions = await loadCSV("data/processed/interactions_clean.csv");
    recommendations = await loadCSV("data/processed/recommendations.csv");

    // populate user dropdown
    let select = document.getElementById("userSelect");
    users.forEach(u => {
        let opt = document.createElement("option");
        opt.value = u.user_id;
        opt.textContent = `User ${u.user_id}`;
        select.appendChild(opt);
    });

    select.addEventListener("change", updateUser);
    updateUser(); 
    drawEDA();
}

function updateUser() {
    let userId = document.getElementById("userSelect").value;
    let history = interactions.filter(i => i.user_id == userId);
    let historyTable = document.querySelector("#historyTable tbody");
    historyTable.innerHTML = "";
    history.forEach(h => {
        let item = items.find(it => it.item_id == h.item_id);
        let row = `<tr><td>${item.name}</td><td>${h.rating}</td><td>${h.timestamp}</td></tr>`;
        historyTable.innerHTML += row;
    });

    // Top-N recommendation
    let userRec = recommendations.filter(r => r.user_id == userId);
    displayRecommendations(userRec);
}

function displayRecommendations(userRec) {
    let recTable = document.querySelector("#recTable tbody");
    recTable.innerHTML = "";
    let minPrice = parseFloat(document.getElementById("minPrice").value) || 0;
    let maxPrice = parseFloat(document.getElementById("maxPrice").value) || Infinity;

    userRec.forEach(r => {
        let item = items.find(it => it.item_id == r.item_id);
        if(item.price >= minPrice && item.price <= maxPrice){
            let row = `<tr><td>${item.name}</td><td>${item.price}</td></tr>`;
            recTable.innerHTML += row;
        }
    });
}

function applyPriceFilter(){
    let userId = document.getElementById("userSelect").value;
    let userRec = recommendations.filter(r => r.user_id == userId);
    displayRecommendations(userRec);
}

function drawEDA(){
    // Rating distribution
    let ratings = interactions.map(i=>+i.rating || 1);
    let ratingCounts = {};
    ratings.forEach(r=>ratingCounts[r]=(ratingCounts[r]||0)+1);

    new Chart(document.getElementById("ratingChart"), {
        type: 'bar',
        data: {
            labels: Object.keys(ratingCounts),
            datasets:[{label:'Rating Distribution', data:Object.values(ratingCounts), backgroundColor:'#ff69b4'}]
        }
    });

    // Price distribution
    let prices = items.map(i=>+i.price || 0);
    let bins = Array(10).fill(0);
    let minP=Math.min(...prices), maxP=Math.max(...prices);
    prices.forEach(p=>{
        let idx = Math.floor((p-minP)/(maxP-minP)*10);
        if(idx==10) idx=9;
        bins[idx]++;
    });
    new Chart(document.getElementById("priceChart"), {
        type:'bar',
        data:{
            labels: bins.map((_,i)=>`${(minP+(maxP-minP)/10*i).toFixed(2)}-${(minP+(maxP-minP)/10*(i+1)).toFixed(2)}`),
            datasets:[{label:'Price Distribution', data:bins, backgroundColor:'#ff1493'}]
        }
    });

    // Top 10 items by popularity
    let itemCounts = {};
    interactions.forEach(i=>itemCounts[i.item_id] = (itemCounts[i.item_id]||0)+1);
    let topItems = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
    new Chart(document.getElementById("topItemsChart"), {
        type:'bar',
        data:{
            labels: topItems.map(t=>items.find(it=>it.item_id==t[0]).name),
            datasets:[{label:'Top 10 Items', data:topItems.map(t=>t[1]), backgroundColor:'#ff69b4'}]
        }
    });
}

loadData();
