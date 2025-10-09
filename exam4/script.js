function updateUserDisplay(){
    const userId = document.getElementById("userSelect").value;
    const history = interactions.filter(i=>i.user_id==userId);
    const tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML="";
    history.forEach(h=>{
        const it = items.find(itm=>itm.item_id==h.item_id);
        const row = `<tr>
            <td>${it?it.name:h.item_id}</td>
            <td>${h.Quantity||1}</td>
            <td>${h.timestamp}</td>
            <td>${it?it.price:"-"}</td>
        </tr>`;
        tbody.innerHTML += row;
    });
    displayRecommendations(recommendations[userId]);
}

function applyPriceFilter(){
    const userId = document.getElementById("userSelect").value;
    const min = parseFloat(document.getElementById("minPrice").value) || 0;
    const max = parseFloat(document.getElementById("maxPrice").value) || Infinity;
    const filtered = recommendations[userId].filter(r=>r.price>=min && r.price<=max);
    displayRecommendations(filtered);
}

function displayRecommendations(recs){
    const tbody = document.querySelector("#recTable tbody");
    tbody.innerHTML="";
    recs.slice(0,10).forEach(r=>{
        const row = `<tr title="Similarity Score: ${r.score}">
            <td>${r.name}</td>
            <td>${r.price}</td>
            <td>${r.score}</td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// EDA Charts
function drawEDA(){
    // Ratings distribution
    const ratingCounts = {};
    interactions.forEach(i=>ratingCounts[i.rating]=(ratingCounts[i.rating]||0)+1);
    new Chart(document.getElementById("ratingChart"),{
        type:'bar',
        data:{
            labels:Object.keys(ratingCounts),
            datasets:[{label:'Rating Distribution', data:Object.values(ratingCounts), backgroundColor:'#ff69b4'}]
        }
    });

    // Price distribution
    const prices = items.map(it=>+it.price||0);
    const bins = Array(10).fill(0);
    const maxPrice = Math.max(...prices);
    prices.forEach(p=>{
        let idx = Math.floor(p/(maxPrice/10));
        if(idx>=10) idx=9;
        bins[idx]++;
    });
    new Chart(document.getElementById("priceChart"),{
        type:'bar',
        data:{
            labels:["0-10%","10-20%","20-30%","30-40%","40-50%","50-60%","60-70%","70-80%","80-90%","90-100%"],
            datasets:[{label:'Price Distribution', data:bins, backgroundColor:'#ff1493'}]
        }
    });

    // Top 10 items
    const counts = {};
    interactions.forEach(i=>counts[i.item_id]=(counts[i.item_id]||0)+1);
    const topItems = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
    new Chart(document.getElementById("topItemsChart"),{
        type:'bar',
        data:{
            labels: topItems.map(t=>items.find(it=>it.item_id==t[0])?.name||t[0]),
            datasets:[{label:'Top Items', data: topItems.map(t=>t[1]), backgroundColor:'#ff69b4'}]
        }
    });
}

document.getElementById("applyFilter").addEventListener("click", applyPriceFilter);

window.onload = async () => {
    await loadData();
    drawEDA();
};
