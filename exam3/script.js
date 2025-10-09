// Update user view
function updateUser(){
    let userId = document.getElementById("userSelect").value;

    // Purchase history
    let history = interactions.filter(i => i.user_id==userId);
    let tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML="";
    history.forEach(h=>{
        let it = items.find(itm=>itm.item_id==h.item_id);
        let row = `<tr>
            <td>${it ? it.name : h.item_id}</td>
            <td>${h.Quantity || 1}</td>
            <td>${h.timestamp}</td>
            <td>${it ? it.price : "-"}</td>
        </tr>`;
        tbody.innerHTML += row;
    });

    displayRecommendations(recommendations[userId]);
}

// Apply price filter
function applyPriceFilter(){
    let userId = document.getElementById("userSelect").value;
    let min = parseFloat(document.getElementById("minPrice").value) || 0;
    let max = parseFloat(document.getElementById("maxPrice").value) || Infinity;
    let recs = recommendations[userId].filter(r=>r.price>=min && r.price<=max);
    displayRecommendations(recs);
}

function displayRecommendations(recs){
    let tbody = document.querySelector("#recTable tbody");
    tbody.innerHTML="";
    recs.slice(0,10).forEach(r=>{
        let row = `<tr><td>${r.name}</td><td>${r.price}</td></tr>`;
        tbody.innerHTML += row;
    });
}

// Draw EDA charts
function drawEDA(){
    // Rating distribution
    let ratings = interactions.map(i=>+i.rating || 1);
    let ratingCounts = {};
    ratings.forEach(r=>ratingCounts[r]=(ratingCounts[r]||0)+1);
    new Chart(document.getElementById("ratingChart"), {
        type:'bar',
        data:{
            labels:Object.keys(ratingCounts),
            datasets:[{label:'Rating Distribution', data:Object.values(ratingCounts), backgroundColor:'#ff69b4'}]
        }
    });

    // Price distribution
    let prices = items.map(i=>+i.price || 0);
    let priceBins = Array(10).fill(0);
    let maxP = Math.max(...prices);
    prices.forEach(p=>{
        let idx = Math.floor(p/(maxP/10));
        if(idx>=10) idx=9;
        priceBins[idx]++;
    });
    new Chart(document.getElementById("priceChart"), {
        type:'bar',
        data:{
            labels:["0-10%","10-20%","20-30%","30-40%","40-50%","50-60%","60-70%","70-80%","80-90%","90-100%"],
            datasets:[{label:'Price Distribution', data:priceBins, backgroundColor:'#ff1493'}]
        }
    });

    // Top 10 items
    let itemCounts = {};
    interactions.forEach(i=>itemCounts[i.item_id]=(itemCounts[i.item_id]||0)+1);
    let topItems = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
    new Chart(document.getElementById("topItemsChart"), {
        type:'bar',
        data:{
            labels: topItems.map(t=>items.find(it=>it.item_id==t[0])?.name || t[0]),
            datasets:[{label:'Top 10 Items', data:topItems.map(t=>t[1]), backgroundColor:'#ff69b4'}]
        }
    });
}

// Initialize
window.onload = async () => {
    await loadData();
    drawEDA();
};
