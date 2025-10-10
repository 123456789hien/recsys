const DATA_URL = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/hs_exam/fashion_recommender.csv";

let fashionData = [];
let currentCategory = "All";

// Load CSV
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

// Initialize
function initUI() {
  updateTopRecommendations();
  updateProductOptions();
  addButtonListeners();
}

// Buttons
function addButtonListeners() {
  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.category;
      updateTopRecommendations();
      updateEDA();
    });
  });

  document.getElementById("show-similar").addEventListener("click", showSimilarProducts);
  document.getElementById("predict-btn").addEventListener("click", predictRating);
}

// Filter by category
function getFilteredData() {
  return currentCategory === "All" ? fashionData : fashionData.filter(d => d.category === currentCategory);
}

// Top Recommendations
function updateTopRecommendations() {
  const data = getFilteredData();
  const top = data.sort((a,b)=>b.rating/b.price - a.rating/a.price).slice(0,5);
  const container = document.getElementById("top-recommendations");
  container.innerHTML = "";
  top.forEach(p=>{
    const div=document.createElement("div");
    div.classList.add("card");
    div.innerHTML=`<b>${p.productId} - ${p.productName}</b><br>Brand: ${p.brand}<br>Price: $${p.price}<br>Rating: ${p.rating}/5 <span class="badge">🔥 Hot</span>`;
    container.appendChild(div);
  });
}

// Product options
function updateProductOptions() {
  const productSelect = document.getElementById("product-select");
  const productIdSelect = document.getElementById("product-id-select");
  const uniqueProducts = [...new Map(fashionData.map(p=>[p.productName,p])).values()];
  uniqueProducts.forEach(p=>{
    const opt1 = document.createElement("option");
    opt1.value = p.productName;
    opt1.textContent = p.productName;
    productSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = p.productId;
    opt2.textContent = `${p.productId} - ${p.productName}`;
    productIdSelect.appendChild(opt2);
  });
}

// Similar Products
function showSimilarProducts() {
  const selectedName = document.getElementById("product-select").value;
  const data = getFilteredData();
  const target = data.find(d => d.productName === selectedName);
  if(!target) return alert("No product found.");

  const similar = data.filter(p =>
    p.productName !== target.productName &&
    Math.abs(p.rating-target.rating)<1 &&
    Math.abs(p.price-target.price)<20
  ).slice(0,5);

  const container = document.getElementById("similar-products-container");
  container.innerHTML="";
  similar.forEach(p=>{
    const div=document.createElement("div");
    div.classList.add("card");
    div.innerHTML=`<b>${p.productId} - ${p.productName}</b><br>Brand: ${p.brand}<br>Price: $${p.price}<br>Rating: ${p.rating}/5`;
    container.appendChild(div);
  });

  updatePurchaseHistory(selectedName);
  updateEDA();
  updateTop10(similar);
}

// Purchase History
function updatePurchaseHistory(productName){
  const tableDiv = document.getElementById("purchase-history-table");
  const history = fashionData.filter(p=>p.productName===productName);
  if(history.length===0){
    tableDiv.innerHTML="<p>No purchase history found.</p>";
    return;
  }
  let html="<table><tr><th>Product ID</th><th>User ID</th><th>Brand</th><th>Rating</th><th>Price</th></tr>";
  history.forEach(p=>{
    html+=`<tr><td>${p.productId}</td><td>${p.userId}</td><td>${p.brand}</td><td>${p.rating}</td><td>$${p.price}</td></tr>`;
  });
  html+="</table>";
  tableDiv.innerHTML=html;
}

// EDA
function updateEDA(){
  const ctxR=document.getElementById("ratingChart");
  const ctxP=document.getElementById("priceChart");
  const data=getFilteredData();

  const ratings = data.map(p=>p.rating);
  const prices = data.map(p=>p.price);

  new Chart(ctxR,{type:"bar",data:{labels:ratings,datasets:[{label:"Rating Distribution",data:ratings}]},options:{plugins:{legend:{display:false}}}});
  new Chart(ctxP,{type:"scatter",data:{datasets:[{label:"Price vs Rating",data:data.map(p=>({x:p.price,y:p.rating}))}]},options:{scales:{x:{title:{display:true,text:"Price"}},y:{title:{display:true,text:"Rating"}}}}});
}

// Predict Rating
function predictRating(){
  const userId = parseInt(document.getElementById("user-id").value);
  const productId = parseInt(document.getElementById("product-id-select").value);
  const data=getFilteredData();
  const userRatings = data.filter(p=>p.userId===userId);
  if(userRatings.length===0){
    document.getElementById("prediction-result").textContent="User not found.";
    return;
  }
  const avg = userRatings.reduce((a,b)=>a+b.rating,0)/userRatings.length;
  const prodName = data.find(p=>p.productId===productId)?.productName || "Unknown";
  document.getElementById("prediction-result").textContent=`Predicted rating for User ${userId} on Product ${productId} - ${prodName}: ${avg.toFixed(2)}/5`;
}

// Top-10 Table
function updateTop10(similar){
  const container=document.getElementById("top10-table");
  const ranked=similar.sort((a,b)=>b.rating-a.rating).slice(0,10);
  let html="<table><tr><th>Rank</th><th>Product ID</th><th>Name</th><th>Brand</th><th>Rating</th><th>Price</th><th>Color</th><th>Size</th><th>Score</th></tr>";
  ranked.forEach((p,i)=>{
    const score = ((p.rating/5)*0.7 + (1/p.price)*0.3).toFixed(3);
    html+=`<tr><td>${i+1}</td><td>${p.productId}</td><td>${p.productName}</td><td>${p.brand}</td><td>${p.rating}</td><td>$${p.price}</td><td>${p.color}</td><td>${p.size}</td><td>${score}</td></tr>`;
  });
  html+="</table>";
  container.innerHTML=html;
}
