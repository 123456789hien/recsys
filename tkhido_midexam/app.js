// ===========================
// Smart Fashion Recommender App
// ===========================
const DATA_URL = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/tkhido_midexam/fashion_recommender.csv";

let allData = [];
let currentCategory = "All";
let selectedProduct = null;

// ===========================
// Load CSV
// ===========================
async function loadData() {
    const res = await fetch(DATA_URL);
    const text = await res.text();
    const rows = text.trim().split("\n");
    const headers = rows[0].split(";");
    allData = rows.slice(1).map(r => {
        const cols = r.split(";");
        let obj = {};
        headers.forEach((h,i)=>{
            let val = cols[i];
            if(h==="Price" || h==="Rating/5") val=parseFloat(val.replace(",","."));
            obj[h] = val;
        });
        return obj;
    });
}

// ===========================
// Filter by Category
// ===========================
function getCategoryData(category) {
    if(category==="All") return allData;
    return allData.filter(d=>d.Category===category);
}

// ===========================
// Top Recommendations
// ===========================
function showTopRecommendations() {
    const container = document.getElementById("top-recommendations-container");
    container.innerHTML = "";
    const data = getCategoryData(currentCategory);
    data.sort((a,b)=> (b["Rating/5"]+b.Price*0.01) - (a["Rating/5"]+a.Price*0.01));
    data.slice(0,5).forEach((d,i)=>{
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `<div class="badge-hot">🔥</div>
            <strong>${d["Product Name"]}</strong><br>
            Brand: ${d.Brand}<br>
            Rating: ${d["Rating/5"]}<br>
            Price: $${d.Price}`;
        container.appendChild(card);
    });
}

// ===========================
// Populate Product Select
// ===========================
function populateProductSelect() {
    const select = document.getElementById("product-select");
    select.innerHTML="";
    const data = getCategoryData(currentCategory);
    const productNames = [...new Set(data.map(d=>d["Product Name"]))];
    productNames.forEach(name=>{
        const option = document.createElement("option");
        option.value=name;
        option.textContent=name;
        select.appendChild(option);
    });
    selectedProduct = productNames[0];
}

// ===========================
// Cosine similarity
// ===========================
function cosineSimilarity(a,b) {
    const dot = a.reduce((sum,ai,i)=>sum+ai*b[i],0);
    const magA = Math.sqrt(a.reduce((sum,ai)=>sum+ai*ai,0));
    const magB = Math.sqrt(b.reduce((sum,bi)=>sum+bi*bi,0));
    return dot/(magA*magB);
}

// ===========================
// Show Similar Products
// ===========================
function showSimilarProducts() {
    const container = document.getElementById("similar-products-container");
    container.innerHTML="";
    selectedProduct = document.getElementById("product-select").value;
    const data = getCategoryData(currentCategory).filter(d=>d["Product Name"]===selectedProduct);
    // normalize rating & price
    const ratings = data.map(d=>d["Rating/5"]);
    const prices = data.map(d=>d.Price);
    const minR=Math.min(...ratings), maxR=Math.max(...ratings);
    const minP=Math.min(...prices), maxP=Math.max(...prices);
    const normData = data.map(d=>({...d, norm:[(d["Rating/5"]-minR)/(maxR-minR||1),(d.Price-minP)/(maxP-minP||1)]}));
    // compute similarity
    const selectedNorm = normData[0].norm;
    const sims = normData.map(d=>({...d, sim:cosineSimilarity(selectedNorm,d.norm)}));
    sims.sort((a,b)=>b.sim-a.sim);
    sims.slice(1,6).forEach(d=>{
        const card = document.createElement("div");
        card.className="card";
        card.innerHTML=`<strong>${d["Product Name"]}</strong><br>ID:${d["Product ID"]}<br>Brand:${d.Brand}<br>Rating:${d["Rating/5"]}<br>Price:${d.Price}`;
        container.appendChild(card);
    });
}

// ===========================
// Purchase History
// ===========================
function updatePurchaseHistory() {
    const tbody = document.querySelector("#purchase-history-table tbody");
    tbody.innerHTML="";
    const data = getCategoryData(currentCategory).filter(d=>d["Product Name"]===selectedProduct);
    data.forEach(d=>{
        const tr = document.createElement("tr");
        tr.innerHTML=`<td>${d["Product ID"]}</td><td>${d["User ID"]}</td><td>${d.Brand}</td><td>${d["Rating/5"]}</td><td>${d.Price}</td>`;
        tbody.appendChild(tr);
    });
}

// ===========================
// EDA Charts
// ===========================
let ratingChart, priceChart, scatterChart;
function updateEDACharts() {
    const data = getCategoryData(currentCategory);
    const ratings = data.map(d=>d["Rating/5"]);
    const prices = data.map(d=>d.Price);
    const ctxR = document.getElementById("rating-chart").getContext("2d");
    const ctxP = document.getElementById("price-chart").getContext("2d");
    const ctxS = document.getElementById("price-rating-scatter").getContext("2d");

    if(ratingChart) ratingChart.destroy();
    if(priceChart) priceChart.destroy();
    if(scatterChart) scatterChart.destroy();

    ratingChart = new Chart(ctxR,{type:'bar',data:{labels:ratings.map((_,i)=>i+1),datasets:[{label:'Rating',data:ratings,backgroundColor:'#ff69b4'}]},options:{responsive:true,title:{display:true,text:'Rating Distribution'}}});
    priceChart = new Chart(ctxP,{type:'bar',data:{labels:prices.map((_,i)=>i+1),datasets:[{label:'Price',data:prices,backgroundColor:'#ffb6c1'}]},options:{responsive:true,title:{display:true,text:'Price Distribution'}}});
    scatterChart = new Chart(ctxS,{type:'scatter',data:{datasets:[{label:'Price vs Rating',data:data.map(d=>({x:d.Price,y:d["Rating/5"]})),backgroundColor:'#ff1493'}]},options:{responsive:true,title:{display:true,text:'Price vs Rating Scatter'}}});
}

// ===========================
// Top-10 Tables
// ===========================
function updateTop10Tables() {
    const data = getCategoryData(currentCategory).filter(d=>d["Product Name"]===selectedProduct);
    const tbodyR = document.querySelector("#top10-rating-table tbody");
    const tbodyS = document.querySelector("#top10-score-table tbody");
    tbodyR.innerHTML="";tbodyS.innerHTML="";
    const maxR = Math.max(...data.map(d=>d["Rating/5"]));
    const maxP = Math.max(...data.map(d=>d.Price));
    data.forEach((d,i)=>{
        const trR=document.createElement("tr");
        trR.innerHTML=`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d["Rating/5"]}</td><td>${d.Color}</td><td>${d.Size}</td>`;
        tbodyR.appendChild(trR);
        const score = 0.5*(d["Rating/5"]/maxR)+0.3*(d.Price/maxP)+0.2*Math.random();
        const trS=document.createElement("tr");
        trS.innerHTML=`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d["Rating/5"]}</td><td>${d.Price}</td><td>${d.Color}</td><td>${d.Size}</td><td>${score.toFixed(2)}</td>`;
        tbodyS.appendChild(trS);
    });
}

// ===========================
// Event Listeners
// ===========================
document.addEventListener("DOMContentLoaded", async ()=>{
    await loadData();
    showTopRecommendations();
    populateProductSelect();
    updateEDACharts();
    updateTop10Tables();
    updatePurchaseHistory();

    document.querySelectorAll(".category-btn").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            currentCategory = btn.dataset.category;
            document.querySelectorAll(".category-btn").forEach(b=>b.classList.remove("active"));
            btn.classList.add("active");
            showTopRecommendations();
            populateProductSelect();
            updateEDACharts();
            updateTop10Tables();
            updatePurchaseHistory();
            document.getElementById("similar-products-container").innerHTML="";
        });
    });

    document.getElementById("show-similar-btn").addEventListener("click", ()=>{
        showSimilarProducts();
        updateTop10Tables();
        updatePurchaseHistory();
    });
});
