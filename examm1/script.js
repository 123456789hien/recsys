// Globals
let selectedUser = null;
let ratingChart, priceChart;

// Load CSV event listeners
document.getElementById("btnLoadData").addEventListener("click", () => {
  const fUsers = document.getElementById("fileUsers").files[0];
  const fItems = document.getElementById("fileItems").files[0];
  const fInteractions = document.getElementById("fileInteractions").files[0];
  if (!fUsers || !fItems || !fInteractions) {
    alert("Please select all 3 CSV files");
    return;
  }
  loadUsers(fUsers);
  loadItems(fItems);
  loadInteractions(fInteractions);
});

// Populate location dropdown
function populateLocationDropdown() {
  const locSet = new Set(users.map(u => u.location));
  const dropdown = document.getElementById("locationDropdown");
  locSet.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc; opt.innerText = loc;
    dropdown.appendChild(opt);
  });
  document.getElementById("noteLocation").innerText = "✅ Locations ready.";
}

// Update user dropdown based on location
document.getElementById("locationDropdown").addEventListener("change", e => {
  const loc = e.target.value;
  const filteredUsers = loc === "all" ? users : users.filter(u => u.location === loc);
  const dropdown = document.getElementById("userDropdown");
  dropdown.innerHTML = `<option value="">Select a user</option>`;
  filteredUsers.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.user_id; opt.innerText = u.user_id;
    dropdown.appendChild(opt);
  });
  document.getElementById("noteUser").innerText = `✅ Users for location "${loc}" ready.`;
});

// Display purchase history
document.getElementById("userDropdown").addEventListener("change", e => {
  selectedUser = e.target.value;
  displayPurchaseHistory(selectedUser);
});

function displayPurchaseHistory(user_id) {
  if (!user_id) return;
  const hist = interactions.filter(i => i.user_id === user_id);
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = "";
  hist.forEach(i => {
    const itemName = items.find(it => it.item_id === i.item_id)?.name || i.item_id;
    const row = `<tr><td>${itemName}</td><td>${i.price}</td><td>${i.rating}</td><td>${i.timestamp}</td></tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });
  updateEDACharts(hist);
  document.getElementById("noteHistory").innerText = `✅ Purchase history for user ${user_id} displayed.`;
}

// EDA Charts
function updateEDACharts(hist) {
  const ratings = hist.map(h => h.rating);
  const prices = hist.map(h => h.price);

  // Destroy previous chart if exists
  if (ratingChart) ratingChart.destroy();
  if (priceChart) priceChart.destroy();

  const ctxR = document.getElementById("ratingChart").getContext("2d");
  ratingChart = new Chart(ctxR, {
    type: "bar",
    data: { labels: ratings.map((_, i) => i+1), datasets: [{ label:"Rating Distribution", data: ratings, backgroundColor:"#d6336c" }] },
    options: { responsive:true, plugins:{legend:{display:true}}, scales:{y:{beginAtZero:true}} }
  });

  const ctxP = document.getElementById("priceChart").getContext("2d");
  priceChart = new Chart(ctxP, {
    type: "bar",
    data: { labels: prices.map((_, i) => i+1), datasets: [{ label:"Price Distribution", data: prices, backgroundColor:"#ff99cc" }] },
    options: { responsive:true, plugins:{legend:{display:true}}, scales:{y:{beginAtZero:true}} }
  });
}

// Embeddings upload
document.getElementById("btnLoadEmbeddings").addEventListener("click", () => {
  const f = document.getElementById("fileEmbeddings").files[0];
  if (!f) return alert("Select JSON embeddings file!");
  const reader = new FileReader();
  reader.onload = e => {
    itemEmbeddings = JSON.parse(e.target.result);
    document.getElementById("noteEmbeddings").innerText = "✅ Embeddings loaded.";
  };
  reader.readAsText(f);
});

// Download template embeddings
document.getElementById("btnDownloadTemplate").addEventListener("click", () => {
  const template = {};
  items.forEach(it => { template[it.item_id] = Array(16).fill(0); });
  const blob = new Blob([JSON.stringify(template, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "item_embeddings_template.json"; a.click();
});

// Compute Top-N Recommendations
document.getElementById("btnComputeTopN").addEventListener("click", () => {
  if (!selectedUser) return alert("Select a user first");
  if (!Object.keys(itemEmbeddings).length) return alert("Upload embeddings first");
  computeTopNRecommendations(selectedUser);
});

function computeTopNRecommendations(user_id) {
  const histItems = interactions.filter(i => i.user_id === user_id).map(i=>i.item_id);
  const allScores = [];

  items.forEach(it => {
    const emb = itemEmbeddings[it.item_id];
    if (!emb) return;
    // similarity with purchased items
    let sim = 0;
    histItems.forEach(hid => {
      const hEmb = itemEmbeddings[hid];
      if (!hEmb) return;
      const dot = emb.reduce((acc,v,i)=>acc+v*hEmb[i],0);
      sim += dot;
    });
    sim = histItems.length ? sim / histItems.length : 0;
    // rating average
    const ratings = interactions.filter(i=>i.item_id===it.item_id).map(i=>i.rating);
    const avgRating = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0;
    const price = it.price || 1;
    const scoreValue = avgRating/price; // best value
    allScores.push({item:it, scoreValue, avgRating, sim, price});
  });

  // Sort and fill tables
  const bestValue = [...allScores].sort((a,b)=>b.scoreValue-a.scoreValue).slice(0,10);
  const highestRated = [...allScores].sort((a,b)=>b.avgRating-b.avgRating).slice(0,10);
  const mostSimilar = [...allScores].sort((a,b)=>b.sim-b.sim).slice(0,10);

  function fillTable(tableId, arr, col1, col2, col3) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = "";
    arr.forEach(r=>{
      tbody.insertAdjacentHTML("beforeend",
        `<tr><td>${r.item.name}</td><td>${r[col2]}</td><td>${r[col3]}</td></tr>`);
    });
  }

  fillTable("bestValueTable", bestValue, "item", "scoreValue", "price");
  fillTable("highestRatedTable", highestRated, "item", "avgRating", "price");
  fillTable("mostSimilarTable", mostSimilar, "item", "sim", "price");

  document.getElementById("noteTopN").innerText = `✅ Top-10 recommendations computed for user ${user_id}`;
}
