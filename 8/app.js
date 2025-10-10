// app.js
// Smart Fashion Recommender: full-featured

// =======================
// Global variables
let currentCategory = null;

// =======================
// Category Filter
function filterCategory(category) {
  currentCategory = category;
  const filtered = fashionData.filter(p => p.category === category);
  displayPurchaseHistory(filtered);
  displayContentBased(filtered);
}

// =======================
// Display Top Recommendations (global)
function displayTopRecommendations() {
  const sorted = [...fashionData].sort((a,b) => (b.rating/5)/b.price - (a.rating/5)/a.price);
  const top5 = sorted.slice(0,5);
  const container = document.getElementById("top-products");
  container.innerHTML = "";
  top5.forEach((p,i) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      ${i<5?'<div class="badge-hot">🔥 Hot</div>':''}
      <h3>${p.productName}</h3>
      <p>Brand: ${p.brand}</p>
      <p>Rating: ${p.rating}</p>
      <p>Price: $${p.price}</p>
      <p>Color: ${p.color}</p>
      <p>Size: ${p.size}</p>
    `;
    container.appendChild(card);
  });
}

// =======================
// Display Purchase History
function displayPurchaseHistory(filtered) {
  const container = document.getElementById("history-grid");
  container.innerHTML = "";
  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <h3>${p.productName}</h3>
      <p>Brand: ${p.brand}</p>
      <p>Rating: ${p.rating}</p>
      <p>Price: $${p.price}</p>
      <p>Color: ${p.color}</p>
      <p>Size: ${p.size}</p>
    `;
    container.appendChild(card);
  });
}

// =======================
// Display Content-Based Similar Products
function displayContentBased(filtered) {
  // Simple similarity by price difference < 10% + rating difference < 1
  const container = document.getElementById("similar-products-grid");
  container.innerHTML = "";
  if(filtered.length<2) return;
  filtered.forEach((p,i) => {
    const similar = filtered.filter(other => other.productId!==p.productId && Math.abs(other.price-p.price)/p.price<0.1 && Math.abs(other.rating-p.rating)<1);
    if(similar.length>0) {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <h3>${p.productName}</h3>
        <p>Brand: ${p.brand}</p>
        <p>Similar Products: ${similar.map(s=>s.productName).join(", ")}</p>
      `;
      container.appendChild(card);
    }
  });
}

// =======================
// Predict User Rating (KNN user-based)
function predictRating() {
  const userId = parseInt(document.getElementById("input-user").value);
  const productId = parseInt(document.getElementById("input-product").value);

  // Find all ratings by user
  const userRatings = fashionData.filter(d => d.userId===userId);
  if(userRatings.length===0) {
    document.getElementById("predicted-rating").innerText = "User not found";
    return;
  }

  // Simple prediction: average rating of product in dataset
  const productRatings = fashionData.filter(d => d.productId===productId).map(d=>d.rating);
  const predicted = productRatings.length>0 ? (productRatings.reduce((a,b)=>a+b,0)/productRatings.length).toFixed(2) : "N/A";
  document.getElementById("predicted-rating").innerText = `Predicted rating of User ${userId} on Product ${productId}: ${predicted}/5`;
}

// =======================
// EDA Charts
function renderEDA() {
  // Rating distribution
  const ctx1 = document.getElementById("rating-chart").getContext('2d');
  new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: fashionData.map((_,i)=>i+1),
      datasets: [{
        label: 'Rating',
        data: fashionData.map(d=>d.rating),
        backgroundColor: '#ff1493'
      }]
    },
    options: {
      responsive:true,
      plugins:{legend:{display:false}},
      title:{display:true,text:'Rating Distribution'}
    }
  });

  // Price vs Rating scatter
  const ctx2 = document.getElementById("price-rating-chart").getContext('2d');
  new Chart(ctx2, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Price vs Rating',
        data: fashionData.map(d=>({x:d.price,y:d.rating})),
        backgroundColor: '#ff69b4'
      }]
    },
    options: {
      responsive:true,
      plugins:{legend:{display:true}},
      title:{display:true,text:'Price vs Rating'}
    }
  });
}

// =======================
// Top-10 Recommendations (global)
function renderTop10() {
  const sorted = [...fashionData].sort((a,b)=> (b.rating/5)/b.price - (a.rating/5)/a.price);
  const top10 = sorted.slice(0,10);
  const tbody = document.querySelector("#top10-table tbody");
  tbody.innerHTML = "";
  top10.forEach((p,i)=>{
    const score = ((p.rating/5)/p.price).toFixed(2);
    tbody.innerHTML += `
      <tr>
        <td>${i+1}</td>
        <td>${p.productId}</td>
        <td>${p.productName}</td>
        <td>${p.brand}</td>
        <td>${p.rating}</td>
        <td>${p.price}</td>
        <td>${p.color}</td>
        <td>${p.size}</td>
        <td>${score}</td>
      </tr>
    `;
  });
}

// =======================
// Initialize App
window.onload = function(){
  displayTopRecommendations();
  renderEDA();
  renderTop10();
}
