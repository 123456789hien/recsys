window.onload = async () => {
  await loadData();

  document.getElementById("locationFilter").addEventListener("change", filterUsersByLocation);
  document.getElementById("userSelect").addEventListener("change", showUserHistory);
  document.getElementById("uploadEmbeddings").addEventListener("change", uploadEmbeddings);
  document.getElementById("downloadEmbeddings").addEventListener("click", downloadTemplateEmbeddings);
};

function filterUsersByLocation() {
  const loc = document.getElementById("locationFilter").value;
  const userSelect = document.getElementById("userSelect");
  userSelect.innerHTML = "<option value=''>Select User</option>";

  const filteredUsers = loc === "all" ? users : users.filter(u => u.location === loc);
  filteredUsers.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.user_id;
    opt.textContent = u.user_id;
    userSelect.appendChild(opt);
  });

  document.getElementById("noteLocation").textContent = `✅ ${filteredUsers.length} users in selected location`;
}

function showUserHistory() {
  const userId = document.getElementById("userSelect").value;
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = "";

  if (!userId) return;

  const history = interactions.filter(i => i.user_id === userId);
  history.forEach(i => {
    const item = items.find(it => it.item_id === i.item_id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item ? item.name : i.item_id}</td>
      <td>${item ? item.price : "-"}</td>
      <td>${i.rating}</td>
      <td>${i.timestamp}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("noteHistory").textContent = `✅ Showing ${history.length} purchases`;
  drawEDACharts(userId, history);
}

function drawEDACharts(userId, history) {
  const ratingCtx = document.getElementById("ratingChart").getContext("2d");
  const priceCtx = document.getElementById("priceChart").getContext("2d");

  const ratings = history.map(h => parseFloat(h.rating));
  const prices = history.map(h => {
    const item = items.find(it => it.item_id === h.item_id);
    return item ? parseFloat(item.price) : 0;
  });

  new Chart(ratingCtx, {
    type: "bar",
    data: {
      labels: history.map(h => h.item_id),
      datasets: [{ label: `Ratings of User ${userId}`, data: ratings, backgroundColor: "#ff80bf" }]
    }
  });

  new Chart(priceCtx, {
    type: "bar",
    data: {
      labels: history.map(h => h.item_id),
      datasets: [{ label: `Prices of User ${userId}`, data: prices, backgroundColor: "#ff3399" }]
    }
  });
}

// --- EMBEDDINGS ---
function uploadEmbeddings(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    itemEmbeddings = JSON.parse(e.target.result);
    document.getElementById("noteEmbeddings").textContent = "✅ Embeddings loaded";
  };
  reader.readAsText(file);
}

function downloadTemplateEmbeddings() {
  const template = {};
  items.forEach(i => template[i.item_id] = Array(16).fill(0));
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "item_embeddings_template.json";
  a.click();
  URL.revokeObjectURL(url);
}

// --- TOP-N RECOMMENDATIONS ---
function computeRecommendationsForUser(userId, N = 10) {
  if (!userId || Object.keys(itemEmbeddings).length === 0) return;

  const userHistory = interactions.filter(i => i.user_id === userId).map(i => i.item_id);
  const scores = items.map(it => {
    const emb = itemEmbeddings[it.item_id];
    if (!emb) return { item_id: it.item_id, score: 0 };
    // Simple similarity + price + rating weighting
    let sim = 0;
    userHistory.forEach(histId => {
      const histEmb = itemEmbeddings[histId];
      if (!histEmb) return;
      sim += cosineSim(emb, histEmb);
    });
    sim /= userHistory.length || 1;

    const rating = interactions.filter(i => i.item_id === it.item_id).reduce((acc, x) => acc + parseFloat(x.rating), 0);
    const price = parseFloat(it.price);
    const score = sim * 0.5 + rating * 0.3 + (1 / (1 + price)) * 0.2;
    return { item_id: it.item_id, score, sim, rating, price };
  });

  // Top-N
  const bestValue = [...scores].sort((a,b)=> (b.score / b.price) - (a.score / a.price)).slice(0,N);
  const highestRated = [...scores].sort((a,b)=> b.rating - a.rating).slice(0,N);
  const mostSimilar = [...scores].sort((a,b)=> b.sim - a.sim).slice(0,N);

  renderTopNTable(bestValue, highestRated, mostSimilar);
  document.getElementById("noteTopN").textContent = "✅ Recommendations computed";
}

function renderTopNTable(best, rated, similar) {
  const tbody = document.querySelector("#topNTable tbody");
  tbody.innerHTML = "";
  const N = Math.max(best.length, rated.length, similar.length);
  for (let i=0;i<N;i++){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${best[i] ? `${items.find(it=>it.item_id===best[i].item_id).name} | Score: ${best[i].score.toFixed(2)}` : ""}</td>
      <td>${rated[i] ? `${items.find(it=>it.item_id===rated[i].item_id).name} | Rating: ${rated[i].rating}` : ""}</td>
      <td>${similar[i] ? `${items.find(it=>it.item_id===similar[i].item_id).name} | Sim: ${similar[i].sim.toFixed(2)}` : ""}</td>
    `;
    tbody.appendChild(tr);
  }
}

function cosineSim(a,b){
  let dot = 0, normA=0, normB=0;
  for(let i=0;i<a.length;i++){
    dot += a[i]*b[i]; normA+=a[i]*a[i]; normB+=b[i]*b[i];
  }
  return dot / (Math.sqrt(normA)*Math.sqrt(normB)+1e-9);
}

// Trigger recompute when user selected
document.getElementById("userSelect").addEventListener("change", e=>{
  computeRecommendationsForUser(e.target.value);
});
