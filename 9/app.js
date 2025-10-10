// app.js
// Smart Fashion Recommender - all logic in one file
// Must place `fashion_recommender.csv` in same folder OR upload via UI

// ---------- Global state ----------
let allData = [];              // raw parsed rows
let currentData = [];          // filtered by category
let currentCategory = "All";
let charts = {};               // Chart.js instances

// ---------- Utility: robust CSV parser for semicolon + comma decimals ----------
function parseCSVText(text) {
  // Normalize line endings
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (!lines.length) return [];
  // header might use ; separator
  const headerParts = lines[0].split(";");
  const headers = headerParts.map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    if (cols.length < headers.length) continue; // skip malformed
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ? cols[idx].trim() : "";
    });
    // Normalize fields to consistent keys if present
    // Expect headers like: User ID;Product ID;Product Name;Brand;Category;Price;Rating/5;Color;Size
    const normalized = {
      userId: obj["User ID"] ?? obj["UserID"] ?? obj["user_id"] ?? obj["user"] ?? "",
      productId: obj["Product ID"] ?? obj["ProductID"] ?? obj["product_id"] ?? obj["product"] ?? "",
      name: obj["Product Name"] ?? obj["Name"] ?? obj["product_name"] ?? "",
      brand: obj["Brand"] ?? "",
      category: obj["Category"] ?? obj["category"] ?? "",
      price: obj["Price"] ?? obj["price"] ?? "",
      rating: obj["Rating/5"] ?? obj["Rating"] ?? obj["rating"] ?? "",
      color: obj["Color"] ?? "",
      size: obj["Size"] ?? ""
    };
    // parse numeric fields safely (handle "4,3027" etc)
    const priceVal = parseFloat(
      String(normalized.price).replace(/\./g, "").replace(",", ".")
    );
    const ratingVal = parseFloat(
      String(normalized.rating).replace(/\./g, "").replace(",", ".")
    );
    // Cast productId/userId to int when possible
    const pid = parseInt(String(normalized.productId).replace(/[^0-9]/g, ""));
    const uid = parseInt(String(normalized.userId).replace(/[^0-9]/g, ""));

    rows.push({
      "User ID": isNaN(uid) ? normalized.userId : uid,
      "Product ID": isNaN(pid) ? normalized.productId : pid,
      "Product Name": normalized.name,
      "Brand": normalized.brand,
      "Category": normalized.category,
      "Price": isNaN(priceVal) ? null : priceVal,
      "Rating/5": isNaN(ratingVal) ? null : ratingVal,
      "Color": normalized.color,
      "Size": normalized.size
    });
  }
  return rows;
}

// ---------- Load CSV by fetch (auto-load) ----------
async function autoLoadCSV() {
  setNote("noteGlobal", "Loading CSV via fetch...");
  try {
    const resp = await fetch("fashion_recommender.csv");
    if (!resp.ok) throw new Error("CSV not found in repo root (HTTP " + resp.status + ")");
    const text = await resp.text();
    allData = parseCSVText(text);
    postLoad();
    setNote("noteGlobal", `Loaded ${allData.length} rows from CSV ✅`);
  } catch (err) {
    console.error(err);
    setNote("noteGlobal", "Auto-load failed: " + err.message);
  }
}

// ---------- Upload file handler ----------
function handleFileUpload(file) {
  setNote("noteGlobal", "Reading uploaded file...");
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    allData = parseCSVText(text);
    postLoad();
    setNote("noteGlobal", `Uploaded and parsed ${allData.length} rows ✅`);
  };
  reader.onerror = e => {
    setNote("noteGlobal", "File read error");
  };
  reader.readAsText(file);
}

// ---------- After load: initial render ----------
function postLoad() {
  // unify if any null price/rating set to 0 to avoid chart errors
  allData.forEach(r => {
    if (r["Price"] === null || isNaN(r["Price"])) r["Price"] = 0;
    if (r["Rating/5"] === null || isNaN(r["Rating/5"])) r["Rating/5"] = 0;
  });
  populateProductSelect();
  setCategory("All");
  setNote("noteCategory", "Data ready — pick a category.");
}

// ---------- UI helpers ----------
function setNote(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

// ---------- Category / filtering ----------
function setCategory(category) {
  currentCategory = category;
  if (category === "All") currentData = [...allData];
  else currentData = allData.filter(d => (d["Category"] || "").trim() === category);
  setNote("noteCategory", `Showing ${currentData.length} items in "${category}"`);
  // update everything dependent on category
  populateProductSelect();
  renderTopRecommendations();
  renderTop10Table();
  renderSimilar();       // content based for selected product (if any)
  renderEDACharts();
  renderPurchaseHistoryForSelectedProduct();
}

// ---------- Product select population ----------
function populateProductSelect() {
  const sel = document.getElementById("productSelect");
  sel.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = ""; opt.innerText = "-- select product --";
  sel.appendChild(opt);
  // unique product list within currentData (by Product ID)
  const seen = new Set();
  currentData.forEach(p => {
    const pid = p["Product ID"];
    if (!seen.has(pid)) {
      seen.add(pid);
      const o = document.createElement("option");
      o.value = pid;
      o.innerText = `${pid} — ${String(p["Product Name"]).substring(0,35)}`;
      sel.appendChild(o);
    }
  });
  setNote("noteProduct", `Product selector updated (${seen.size} products)`);
}

// ---------- Purchase history for selected product ----------
function renderPurchaseHistoryForSelectedProduct() {
  const sel = document.getElementById("productSelect");
  const pid = sel.value;
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = "";
  if (!pid) { setNote("noteProduct", "No product selected"); return; }
  const hist = allData.filter(r => String(r["Product ID"]) === String(pid));
  hist.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row["User ID"]}</td>
                    <td>${(row["Rating/5"]||0).toFixed(2)}</td>
                    <td>${row["Price"]!=null?("$"+row["Price"].toFixed(2)):"-"}</td>
                    <td>-</td>`;
    tbody.appendChild(tr);
  });
  setNote("noteProduct", `Displayed ${hist.length} purchases for product ${pid}`);
  // Also update similar products using selected product as seed
  renderSimilar();
}

// ---------- Content-based similarity (for selected product within category) ----------
function renderSimilar() {
  const sel = document.getElementById("productSelect");
  const pid = sel.value;
  const container = document.getElementById("similarGrid");
  container.innerHTML = "";
  if (!pid) { setNote("noteSimilar", "Select a product to see similar items"); return; }
  const seed = currentData.find(d => String(d["Product ID"]) === String(pid));
  if (!seed) { setNote("noteSimilar", "Selected product not in current category"); return; }

  // similarity score: brand/category match (binary), price proximity, rating proximity
  function itemSim(a,b) {
    let s = 0;
    if ((a["Brand"]||"").toLowerCase() === (b["Brand"]||"").toLowerCase()) s += 1.2;
    if ((a["Category"]||"").toLowerCase() === (b["Category"]||"").toLowerCase()) s += 0.8;
    const priceDiff = Math.abs((a["Price"]||0)-(b["Price"]||0));
    const avgPrice = ((a["Price"]||0)+(b["Price"]||0))/2 || 1;
    s += Math.max(0, 1 - (priceDiff/avgPrice)); // closer price -> higher
    const ratingDiff = Math.abs((a["Rating/5"]||0)-(b["Rating/5"]||0));
    s += Math.max(0, 1 - (ratingDiff/5)); // normalize by 5
    return s;
  }

  const candidates = currentData.filter(d => String(d["Product ID"]) !== String(pid));
  const scored = candidates.map(c => ({...c, sim: itemSim(seed,c)}));
  scored.sort((a,b) => b.sim - a.sim);
  const top = scored.slice(0,8);
  top.forEach((p,i) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `<div class="badge">${i<3? "🔥 Hot" : ""}</div>
      <h4>${p["Product Name"]}</h4>
      <div>Brand: ${p["Brand"]}</div>
      <div>Rating: ${(p["Rating/5"]||0).toFixed(2)}</div>
      <div>Price: $${(p["Price"]||0).toFixed(2)}</div>
      <div>Score: ${p.sim.toFixed(3)}</div>`;
    container.appendChild(card);
  });

  setNote("noteSimilar", `Found ${top.length} similar items for product ${pid}`);
}

// ---------- Top Recommendations (category scope) ----------
function renderTopRecommendations() {
  const container = document.getElementById("topGrid");
  container.innerHTML = "";
  // default profile balanced weights
  const profile = document.getElementById("profileSelect").value || "balanced";
  const weights = profile === "balanced"
    ? {sim:0.5, rating:0.4, price:0.1}
    : profile === "rating"
      ? {sim:0.2, rating:0.7, price:0.1}
      : {sim:0.7, rating:0.2, price:0.1};

  // Build quick item-level aggregates: avgRating, popularity
  const itemMap = new Map();
  allData.forEach(r => {
    const pid = String(r["Product ID"]);
    if (!itemMap.has(pid)) itemMap.set(pid, {count:0, sumRating:0, sample: r});
    const s = itemMap.get(pid);
    s.count += 1;
    s.sumRating += (r["Rating/5"]||0);
  });

  // Precompute item avg rating
  const items = Array.from(itemMap.entries()).map(([pid, m])=>{
    const sample = m.sample;
    return {
      pid,
      name: sample["Product Name"],
      brand: sample["Brand"],
      category: sample["Category"],
      price: sample["Price"],
      rating: m.count>0 ? m.sumRating/m.count : (sample["Rating/5"]||0),
      pop: m.count
    };
  }).filter(it => currentCategory === "All" ? true : (it.category === currentCategory));

  // For "sim" we'll compute content-sim to a virtual user profile: average of items in currentData user's history?
  // Sim proxy: item similarity to top popular items in currentData
  // compute popularity rank baseline
  items.forEach(it => {
    // rating normalized 0-1
    it.ratingNorm = (it.rating || 0) / 5;
    // price invert normalized: cheaper -> higher (use log scale)
    it.priceScore = it.price && it.price>0 ? 1 / Math.log10(it.price + 10) : 0.5;
    // sim proxy: how close to category-average price & rating
    it.simProxy = 1 - Math.abs((it.price||0) - avg(currentData.map(x=>x.Price||0))) / (avg(currentData.map(x=>x.Price||0)) + 1);
    it.simProxy += 1 - Math.abs((it.rating||0) - avg(currentData.map(x=>x["Rating/5"]||0)))/5;
  });

  // final score: weighted sum
  items.forEach(it => {
    it.score = weights.sim * it.simProxy + weights.rating * it.ratingNorm + weights.price * it.priceScore;
  });

  items.sort((a,b)=>b.score - a.score);
  const top = items.slice(0,8);
  top.forEach((p,i)=>{
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `<div class="badge">${i<3? "🔥 Hot" : ""}</div>
      <h4>${p.name}</h4>
      <div>Brand: ${p.brand}</div>
      <div>Rating: ${p.rating.toFixed(2)}</div>
      <div>Price: $${(p.price||0).toFixed(2)}</div>
      <div>Score: ${p.score.toFixed(3)}</div>`;
    container.appendChild(card);
  });
  setNote("noteTop", `Top recommendations updated (${top.length}) — profile: ${profile}`);
  // Also update Top-10 table
  renderTop10Table();
}

// ---------- Top-10 Table (more complete) ----------
function renderTop10Table() {
  // use same scoring as renderTopRecommendations but show top 10
  const profile = document.getElementById("profileSelect").value || "balanced";
  const weights = profile === "balanced"
    ? {sim:0.5, rating:0.4, price:0.1}
    : profile === "rating"
      ? {sim:0.2, rating:0.7, price:0.1}
      : {sim:0.7, rating:0.2, price:0.1};

  // aggregate items
  const itemAgg = {};
  allData.forEach(r => {
    const pid = String(r["Product ID"]);
    if (!itemAgg[pid]) itemAgg[pid] = {count:0, sum:0, sample:r};
    itemAgg[pid].count += 1;
    itemAgg[pid].sum += (r["Rating/5"]||0);
  });
  const items = Object.keys(itemAgg).map(pid => {
    const s = itemAgg[pid];
    const sample = s.sample;
    const ratingAvg = s.sum / s.count;
    const price = sample["Price"] || 0;
    const ratingNorm = ratingAvg / 5;
    const priceScore = price>0 ? 1 / Math.log10(price + 10) : 0;
    const simProxy = 1 - Math.abs(price - avg(currentData.map(x=>x.Price||0))) / (avg(currentData.map(x=>x.Price||0)) + 1);
    const score = weights.sim * simProxy + weights.rating * ratingNorm + weights.price * priceScore;
    return {
      pid, name: sample["Product Name"], brand: sample["Brand"], rating: ratingAvg, price, color: sample["Color"], size: sample["Size"], score
    };
  }).filter(it => currentCategory === "All" ? true : (it && it.name && it.brand && (allData.find(d=>String(d["Product ID"])===it.pid)["Category"] === currentCategory)));

  items.sort((a,b)=>b.score - a.score);
  const top10 = items.slice(0,10);
  const tbody = document.querySelector("#top10Table tbody");
  tbody.innerHTML = "";
  top10.forEach((it,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td>
      <td>${it.pid}</td>
      <td>${escapeHtml(it.name)}</td>
      <td>${escapeHtml(it.brand)}</td>
      <td>${(it.rating||0).toFixed(2)}</td>
      <td>${(it.price||0).toFixed(2)}</td>
      <td>${escapeHtml(it.color||"")}</td>
      <td>${escapeHtml(it.size||"")}</td>
      <td>${it.score.toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
  setNote("noteTop", `Top-10 table updated (${top10.length})`);
}

// ---------- Predict rating (KNN user-based) ----------
function predictRatingKNN(k=8) {
  const uidInput = document.getElementById("predUser").value;
  const pidInput = document.getElementById("predProduct").value;
  const uid = uidInput ? String(parseInt(uidInput)) : null;
  const pid = pidInput ? String(parseInt(pidInput)) : null;
  if (!uid || !pid) { setNote("notePredict", "Enter user ID and product ID"); return; }

  // Build user->(pid->rating) map
  const userMap = {};
  allData.forEach(r => {
    const u = String(r["User ID"]);
    const p = String(r["Product ID"]);
    if (!userMap[u]) userMap[u] = {};
    userMap[u][p] = (r["Rating/5"] || 0);
  });

  // If user has rated target product already, return that average
  if (userMap[uid] && userMap[uid][pid]) {
    setNote("notePredict", `User ${uid} already rated product ${pid}: ${userMap[uid][pid].toFixed(2)}/5`);
    return;
  }

  // Compute similarity between target user (uid) and other users using cosine on co-rated items
  // If target user has no history, fallback to global average of product
  const targetRatings = userMap[uid] || {};
  const targetItems = Object.keys(targetRatings);
  if (!targetItems.length) {
    // fallback: product average
    const prodRatings = allData.filter(r => String(r["Product ID"])===pid).map(r=>r["Rating/5"]).filter(Boolean);
    if (prodRatings.length===0) { setNote("notePredict", `No data to predict product ${pid}`); return; }
    const avgProd = avg(prodRatings);
    setNote("notePredict", `Predicted rating (fallback, global avg for product ${pid}): ${avgProd.toFixed(2)}/5`);
    return;
  }

  // compute similarity with other users
  const similarities = [];
  for (const other in userMap) {
    if (other === uid) continue;
    const otherRatings = userMap[other];
    // find common items
    const common = targetItems.filter(it => otherRatings[it] !== undefined);
    if (common.length === 0) continue;
    // build vectors
    const v1 = common.map(it => targetRatings[it]);
    const v2 = common.map(it => otherRatings[it]);
    const sim = cosineSim(v1, v2);
    similarities.push({other, sim});
  }
  similarities.sort((a,b)=>b.sim - a.sim);
  const topK = similarities.slice(0,k);

  // Weighted average rating of topK for the product pid
  let num = 0, den = 0;
  topK.forEach(entry => {
    const r = userMap[entry.other][pid];
    if (r !== undefined) {
      num += entry.sim * r;
      den += Math.abs(entry.sim);
    }
  });
  if (den === 0) {
    // fallback global product avg
    const prodRatings = allData.filter(r => String(r["Product ID"])===pid).map(r=>r["Rating/5"]).filter(Boolean);
    if (!prodRatings.length) { setNote("notePredict", `No ratings for product ${pid} to predict`); return; }
    const avgProd = avg(prodRatings);
    setNote("notePredict", `Predicted rating (fallback): ${avgProd.toFixed(2)}/5`);
    return;
  }
  const predicted = num / den;
  setNote("notePredict", `Predicted rating of User ${uid} on Product ${pid}: ${predicted.toFixed(2)}/5 (K=${topK.length})`);
}

// ---------- EDA charts ----------
function renderEDACharts() {
  renderEDAChartsForData(currentData);
}
function renderEDAChartsForData(data) {
  setNote("noteEDA","Rendering EDA charts...");
  const ratings = data.map(d => d["Rating/5"] || 0);
  const prices = data.map(d => d["Price"] || 0);

  // destroy existing charts
  if (charts.rating) charts.rating.destroy();
  if (charts.price) charts.price.destroy();
  if (charts.scatter) charts.scatter.destroy();

  // Rating histogram (simple bins)
  charts.rating = new Chart(document.getElementById("ratingChart"), {
    type: "bar",
    data: {
      labels: data.map((_,i)=>i+1),
      datasets: [{label:"Rating", data: ratings, backgroundColor:"#ff66b2"}]
    },
    options: { responsive:true, plugins:{title:{display:true,text:"Rating distribution (per item index)"}, legend:{display:false}} }
  });

  // Price histogram
  charts.price = new Chart(document.getElementById("priceChart"), {
    type: "bar",
    data: {
      labels: data.map((_,i)=>i+1),
      datasets: [{label:"Price", data: prices, backgroundColor:"#ff99cc"}]
    },
    options: { responsive:true, plugins:{title:{display:true,text:"Price distribution (per item index)"}, legend:{display:false}} }
  });

  // Scatter Price vs Rating
  charts.scatter = new Chart(document.getElementById("scatterChart"), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Price vs Rating",
        data: data.map(d => ({x: d["Price"] || 0, y: d["Rating/5"] || 0})),
        backgroundColor: "#e60073"
      }]
    },
    options: { responsive:true, plugins:{title:{display:true,text:"Price vs Rating"}}}
  });
  setNote("noteEDA", "EDA ready.");
}

// ---------- helpers ----------
function avg(arr) {
  const a = arr.filter(x => typeof x === "number" && !isNaN(x));
  if (!a.length) return 0;
  return a.reduce((s,v)=>s+v,0)/a.length;
}
function cosineSim(a,b) {
  let dot=0, na=0, nb=0;
  for (let i=0;i<a.length;i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb+=b[i]*b[i]; }
  if (na===0 || nb===0) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}
function escapeHtml(s){ if(!s) return ""; return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ---------- DOM wiring ----------
document.getElementById("btnAutoLoad").addEventListener("click", autoLoadCSV);
document.getElementById("fileUpload").addEventListener("change", e => {
  const f = e.target.files[0];
  if (f) handleFileUpload(f);
});

document.querySelectorAll(".category-btn").forEach(b => {
  b.addEventListener("click", () => {
    const cat = b.getAttribute("data-cat");
    setCategory(cat);
  });
});

document.getElementById("productSelect").addEventListener("change", () => {
  renderPurchaseHistoryForSelectedProduct();
});

document.getElementById("btnComputeTop").addEventListener("click", () => {
  renderTopRecommendations();
});

document.getElementById("btnPredict").addEventListener("click", () => {
  predictRatingKNN(8);
});

// ---------- init: if CSV present, auto load attempted; else wait for upload ----------
setNote("noteGlobal", "Ready. Click Auto-load or Upload CSV.");
// Optionally try to auto-load immediately (commented to avoid noisy console)
// autoLoadCSV();
