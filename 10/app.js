// Smart Fashion Recommender v5 (Full version)
// Author: Sally & GPT-5 ✨
// Purpose: Unified recommender combining EDA, KNN, and Content-based recommendation
// Works directly with GitHub-hosted CSV (fashion_recommender.csv)

// =======================
// 1️⃣ LOAD CSV DATA
// =======================
let data = [];
let currentCategory = "All";

async function loadData() {
  try {
    const response = await fetch("fashion_recommender.csv");
    const csvText = await response.text();

    // Detect semicolon-separated CSV
    const lines = csvText.trim().split("\n");
    const headers = lines[0].replace(/\ufeff/g, "").split(";");

    data = lines.slice(1).map(line => {
      const cols = line.split(";");
      return {
        userId: parseInt(cols[0]),
        productId: parseInt(cols[1]),
        productName: cols[2],
        brand: cols[3],
        category: cols[4],
        price: parseFloat(cols[5].replace(",", ".")),
        rating: parseFloat(cols[6].replace(",", ".")),
        color: cols[7],
        size: cols[8]
      };
    });

    console.log("✅ Data loaded:", data.length, "rows");
    initUI();
    updateEDA();
    updatePurchaseHistory();
    updateTopRecommendations();
  } catch (err) {
    console.error("❌ Error loading CSV:", err);
  }
}

// =======================
// 2️⃣ CATEGORY FILTER
// =======================
document.querySelectorAll(".category-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.dataset.category;
    updatePurchaseHistory();
    updateTopRecommendations();
    updateEDA();
  });
});

// =======================
// 3️⃣ PURCHASE HISTORY
// =======================
function updatePurchaseHistory() {
  const productSelect = document.getElementById("productSelect");
  const tbody = document.querySelector("#purchaseTable tbody");
  productSelect.innerHTML = "";
  tbody.innerHTML = "";

  const filtered = currentCategory === "All"
    ? data
    : data.filter(d => d.category === currentCategory);

  const uniqueNames = [...new Set(filtered.map(d => d.productName))];
  uniqueNames.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    productSelect.appendChild(opt);
  });

  productSelect.addEventListener("change", () => {
    const selected = productSelect.value;
    const rows = filtered.filter(d => d.productName === selected);
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.productId}</td>
        <td>${r.userId}</td>
        <td>${r.brand}</td>
        <td>${r.rating.toFixed(2)}</td>
        <td>${r.price.toFixed(2)}</td>
      </tr>
    `).join("");

    updateSimilarProducts(selected);
  });
}

// =======================
// 4️⃣ TOP RECOMMENDATIONS
// =======================
function updateTopRecommendations() {
  const container = document.getElementById("topRecommendations");
  container.innerHTML = "";

  const filtered = currentCategory === "All"
    ? data
    : data.filter(d => d.category === currentCategory);

  const ranked = filtered
    .sort((a, b) => (b.rating * 0.7 + b.price * 0.3) - (a.rating * 0.7 + a.price * 0.3))
    .slice(0, 10);

  ranked.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${item.productId}. ${item.productName}</h3>
      <p><b>Brand:</b> ${item.brand}</p>
      <p><b>Rating:</b> ${item.rating.toFixed(2)} / 5</p>
      <p><b>Price:</b> $${item.price.toFixed(2)}</p>
      <p><b>Color:</b> ${item.color}, <b>Size:</b> ${item.size}</p>
      ${index < 5 ? `<div class="badge">🔥 Hot</div>` : ""}
    `;
    container.appendChild(card);
  });
}

// =======================
// 5️⃣ SIMILAR PRODUCTS
// =======================
function updateSimilarProducts(productName) {
  const container = document.getElementById("similarProducts");
  container.innerHTML = "";

  const base = data.find(d => d.productName === productName);
  if (!base) return;

  const candidates = data.filter(d =>
    d.category === base.category && d.productName !== productName
  );

  const scored = candidates.map(item => {
    const simRating = 1 - Math.abs(item.rating - base.rating) / 5;
    const simPrice = 1 - Math.abs(item.price - base.price) / Math.max(item.price, base.price);
    const score = (simRating * 0.7 + simPrice * 0.3).toFixed(3);
    return { ...item, score };
  }).sort((a, b) => b.score - a.score).slice(0, 5);

  scored.forEach(s => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${s.productId}. ${s.productName}</h3>
      <p><b>Brand:</b> ${s.brand}</p>
      <p><b>Rating:</b> ${s.rating.toFixed(2)}, <b>Price:</b> $${s.price.toFixed(2)}</p>
      <p><b>Similarity:</b> ${s.score}</p>
    `;
    container.appendChild(card);
  });
}

// =======================
// 6️⃣ PREDICT RATING (KNN)
// =======================
function setupPredictRating() {
  const productSelect = document.getElementById("productIdSelect");
  productSelect.innerHTML = "";

  const uniqueProducts = [...new Set(data.map(d => `${d.productId} - ${d.productName}`))];
  uniqueProducts.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.split(" - ")[0];
    opt.textContent = p;
    productSelect.appendChild(opt);
  });

  document.getElementById("predictBtn").addEventListener("click", () => {
    const userId = parseInt(document.getElementById("userIdInput").value);
    const productId = parseInt(productSelect.value);
    const prediction = predictRating(userId, productId);
    const productName = data.find(d => d.productId === productId)?.productName || "Unknown";

    document.getElementById("predictionResult").textContent =
      `Predicted rating for User ${userId} on product "${productName}" (ID ${productId}): ${prediction.toFixed(2)} / 5`;
  });
}

// Basic KNN (User-based CF)
function predictRating(userId, productId, k = 3) {
  const userRatings = data.filter(d => d.userId === userId);
  if (!userRatings.length) return 3.0;

  const target = data.find(d => d.productId === productId);
  if (!target) return 3.0;

  const sims = [];
  const allUsers = [...new Set(data.map(d => d.userId))];

  allUsers.forEach(u => {
    if (u === userId) return;
    const otherRatings = data.filter(d => d.userId === u && d.category === target.category);
    if (!otherRatings.length) return;
    const common = otherRatings.filter(o => userRatings.some(r => r.productId === o.productId));
    if (!common.length) return;
    const sim = 1 - Math.abs(
      average(common.map(c => c.rating)) - average(userRatings.map(r => r.rating))
    ) / 5;
    sims.push({ user: u, sim });
  });

  const neighbors = sims.sort((a, b) => b.sim - a.sim).slice(0, k);
  const weightedSum = neighbors.reduce((sum, n) => {
    const rating = data.find(d => d.userId === n.user && d.productId === productId)?.rating;
    return rating ? sum + rating * n.sim : sum;
  }, 0);
  const simSum = neighbors.reduce((sum, n) => sum + n.sim, 0);
  return simSum ? weightedSum / simSum : 3.0;
}

// =======================
// 7️⃣ EDA CHARTS
// =======================
function updateEDA() {
  const ctx1 = document.getElementById("ratingChart").getContext("2d");
  const ctx2 = document.getElementById("priceRatingChart").getContext("2d");

  const filtered = currentCategory === "All" ? data : data.filter(d => d.category === currentCategory);
  const ratings = filtered.map(d => d.rating);
  const prices = filtered.map(d => d.price);

  new Chart(ctx1, {
    type: "bar",
    data: {
      labels: [...new Set(ratings.map(r => r.toFixed(0)))],
      datasets: [{ label: "Rating Distribution", data: ratings, borderWidth: 1 }]
    },
  });

  new Chart(ctx2, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Price vs Rating",
        data: filtered.map(d => ({ x: d.price, y: d.rating })),
        pointRadius: 5
      }]
    }
  });

  document.getElementById("edaInsight").textContent =
    `Total Products: ${filtered.length} | Avg Price: $${average(prices).toFixed(2)} | Avg Rating: ${average(ratings).toFixed(2)}`;
}

// =======================
// 8️⃣ UTILITIES
// =======================
function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function initUI() {
  updatePurchaseHistory();
  updateTopRecommendations();
  setupPredictRating();
  updateEDA();
}

// Initialize everything
loadData();
