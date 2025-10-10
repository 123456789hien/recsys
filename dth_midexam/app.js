const DATA_URL = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/dth_midexam/fashion_recommender.csv";

let fashionData = [];
let currentCategory = "All";

fetch(DATA_URL)
  .then(res => res.text())
  .then(text => {
    const rows = text.trim().split("\n");
    const headers = rows[0].split(";");
    fashionData = rows.slice(1).map(r => {
      const cols = r.split(";");
      return {
        userId: parseInt(cols[0]),
        productId: parseInt(cols[1]),
        productName: cols[2],
        brand: cols[3],
        category: cols[4],
        price: parseFloat(cols[5]),
        rating: parseFloat(cols[6].replace(",", ".")),
        color: cols[7],
        size: cols[8]
      };
    });
    initUI();
  })
  .catch(err => console.error("Failed to load CSV:", err));

function initUI() {
  updateTopRecommendations();
  updateProductOptions();
  addButtonListeners();
  updateEDA();
}

function addButtonListeners() {
  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.category;
      updateTopRecommendations();
      updateEDA();
      clearSimilarProducts();
      clearPurchaseHistory();
      updateTop10([]);
    });
  });

  document.getElementById("show-similar").addEventListener("click", showSimilarProducts);
}

function getFilteredData() {
  return currentCategory === "All" ? fashionData : fashionData.filter(d => d.category === currentCategory);
}

// ---------------- Top Recommendations ----------------
function updateTopRecommendations() {
  const data = getFilteredData();
  const top = data.sort((a,b)=>b.rating - a.rating).slice(0,5);
  const container = document.getElementById("top-recommendations");
  container.innerHTML = "";
  top.forEach((p,i)=>{
    const div=document.createElement("div");
    div.classList.add("card");
    div.innerHTML=`<b>${p.productId} - ${p.productName}</b><br><span class="badge">🔥 Hot</span>
    <div class="tooltip">Brand: ${p.brand}<br>Price: $${p.price}<br>Rating: ${p.rating}<br>Color: ${p.color}<br>Size: ${p.size}</div>`;
    container.appendChild(div);
  });
}

// ---------------- Product Select Options ----------------
function updateProductOptions() {
  const productSelect = document.getElementById("product-select");
  productSelect.innerHTML = "<option value=''>Select Product</option>";
  const filtered = getFilteredData();
  const uniqueProducts = [...new Map(filtered.map(p=>[p.productName,p])).values()];
  uniqueProducts.forEach(p=>{
    const opt = document.createElement("option");
    opt.value = p.productName;
    opt.textContent = p.productName;
    productSelect.appendChild(opt);
  });
}

// ---------------- Content-Based Similar Products ----------------
function showSimilarProducts() {
  const selectedName = document.getElementById("product-select").value;
  const data = getFilteredData();
  const target = data.find(d => d.productName === selectedName);
  if(!target) return alert("No product found.");

  const similar = data.filter(p =>
    p.productName === target.productName && p.productId !== target.productId
  ).slice(0,5);

  const container = document.getElementById("similar-products-container");
  container.innerHTML="";
  similar.forEach(p=>{
    const div=document.createElement("div");
    div.classList.add("card");
    div.innerHTML=`<b>${p.productId} - ${p.productName}</b>
    <div class="tooltip">Brand: ${p.brand}<br>Price: $${p.price}<br>Rating: ${p.rating}<br>Color: ${p.color}<br>Size: ${p.size}</div>`;
    container.appendChild(div);
  });

  updatePurchaseHistory(selectedName);
  updateTop10(similar, selectedName);
  updateEDA();
}

// ---------------- Purchase History ----------------
function updatePurchaseHistory(productName){
  const tableDiv = document.getElementById("purchase-history-table");
  const data = getFilteredData().filter(p=>p.productName===productName);
  let html = "<table><tr><th>ProductID</th><th>UserID</th><th>Brand</th><th>Rating</th><th>Price</th></tr>";
  data.forEach(p=>{
    html+=`<tr><td>${p.productId}</td><td>${p.userId}</td><td>${p.brand}</td><td>${p.rating}</td><td>${p.price}</td></tr>`;
  });
  html+="</table>";
  tableDiv.innerHTML = html;
}

// ---------------- Top-10 Table ----------------
function updateTop10(similar=[], selectedName=""){
  const tableDiv = document.getElementById("top10-table");
  const data = getFilteredData();
  const productsToScore = selectedName ? data.filter(p=>p.productName===selectedName) : data;
  const top10 = productsToScore.sort((a,b)=> (b.rating*0.7 + (100-b.price)*0.3) - (a.rating*0.7 + (100-a.price)*0.3)).slice(0,10);

  let html = "<table><tr><th>Rank</th><th>ProductID</th><th>Name</th><th>Brand</th><th>Rating</th><th>Price</th><th>Color</th><th>Size</th><th>Score</th></tr>";
  top10.forEach((p,i)=>{
    const score = (p.rating*0.7 + (100-p.price)*0.3).toFixed(2);
    html+=`<tr><td>${i+1}</td><td>${p.productId}</td><td>${p.productName}</td><td>${p.brand}</td><td>${p.rating}</td><td>${p.price}</td><td>${p.color}</td><td>${p.size}</td><td>${score}</td></tr>`;
  });
  html+="</table>";
  tableDiv.innerHTML=html;
}

// ---------------- EDA ----------------
function updateEDA(){
  const ratingCtx = document.getElementById("ratingChart").getContext("2d");
  const priceCtx = document.getElementById("priceChart").getContext("2d");
  const data = getFilteredData();
  const ratings = data.map(p=>p.rating);
  const prices = data.map(p=>p.price);

  new Chart(ratingCtx,{
    type:"bar",
    data:{
      labels:ratings.map((r,i)=>i+1),
      datasets:[{label:"Rating Distribution",data:ratings,backgroundColor:"#ff69b4"}]
    },
    options:{plugins:{legend:{display:true},title:{display:true,text:"Rating Distribution for selected Category"}},scales:{y:{beginAtZero:true}}}
  });

  new Chart(priceCtx,{
    type:"scatter",
    data:{datasets:[{label:"Price vs Rating",data:data.map(p=>({x:p.price,y:p.rating})),backgroundColor:"#ff1493"}]},
    options:{scales:{x:{title:{display:true,text:"Price"}},y:{title:{display:true,text:"Rating"}}},plugins:{title:{display:true,text:"Price vs Rating for selected Category"}}}
  });
}

// ---------------- Helpers ----------------
function clearSimilarProducts(){ document.getElementById("similar-products-container").innerHTML=""; }
function clearPurchaseHistory(){ document.getElementById("purchase-history-table").innerHTML=""; }
