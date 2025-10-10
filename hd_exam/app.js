// app.js — Final version with corrected raw CSV link and new layout logic

const RAW_CSV_URL = githubToRaw("https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/hmid_exam/fashion_recommender.csv");

// State
let ALL = [];
let currentCategory = "All";
let selectedProductName = null;
let chartHist = null, chartScatter = null;

// Utility: convert GitHub links
function githubToRaw(url) {
  if(url.includes("raw.githubusercontent.com")) return url;
  return url
    .replace("https://github.com/", "https://raw.githubusercontent.com/")
    .replace("/blob/", "/");
}

// Parse CSV flexibly
function parseCSVFlexible(text) {
  text = text.replace(/^\ufeff/, "");
  const lines = text.trim().split(/\r?\n/);
  if(lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h=>h.trim());
  const arr = [];
  for(let i=1;i<lines.length;i++){
    const parts = lines[i].split(sep).map(c=>c.trim());
    if(parts.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx)=> {
      obj[h] = parts[idx];
    });
    arr.push(obj);
  }
  return arr;
}

function toNumberSafe(v) {
  if(v == null) return NaN;
  let s = String(v).trim();
  if(s === "") return NaN;
  s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

// Normalize rows
function normalizeRows(rows) {
  return rows.map(r => {
    const userId = parseInt(r["User ID"]);
    const productId = parseInt(r["Product ID"]);
    const productName = r["Product Name"] || "";
    const brand = r["Brand"] || "";
    const category = r["Category"] || "";
    const price = toNumberSafe(r["Price"]);
    const rating = toNumberSafe(r["Rating/5"]);
    const color = r["Color"] || "";
    const size = r["Size"] || "";
    return {
      userId: isNaN(userId) ? null : userId,
      productId: isNaN(productId) ? null : productId,
      productName, brand, category,
      price: isNaN(price) ? 0 : price,
      rating: isNaN(rating) ? 0 : rating,
      color, size
    };
  }).filter(r => r.productId !== null && r.productName);
}

// Load CSV (auto or upload)
async function loadCsv(url) {
  const response = await fetch(url);
  if(!response.ok) throw new Error("Fetch CSV failed: " + response.status);
  const text = await response.text();
  return parseCSVFlexible(text);
}

// Initialize flow
async function init() {
  try {
    const parsed = await loadCsv(RAW_CSV_URL);
    ALL = normalizeRows(parsed);
    showNote("noteData", `Loaded ${ALL.length} rows from raw CSV`);
    setupCategories();
    populateProductNameSelect();
    populatePredictProductSelect();
    renderAll();
    setupEvents();
  } catch(err) {
    console.error("Error loading:", err);
    showNote("noteData", "Failed to load CSV. Use Upload option.");
  }
}

// Show note
function showNote(id, msg) {
  const el = document.getElementById(id);
  if(el) el.innerText = msg;
}

// Setup category buttons
function setupCategories() {
  document.querySelectorAll(".category-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".category-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.cat;
      renderAll();
    };
  });
}

// Filter by category
function dataByCategory() {
  if(currentCategory === "All") return ALL;
  return ALL.filter(r => r.category === currentCategory);
}

// Top Recommendations
function computeTopRecs(weights = {rating:0.6, pop:0.2, price:0.2}, topK=10) {
  const ds = dataByCategory();
  const agg = {};
  ds.forEach(r => {
    if(!agg[r.productId]) agg[r.productId] = {productId: r.productId, productName: r.productName, brand: r.brand, price: r.price, ratings: []};
    agg[r.productId].ratings.push(r.rating);
  });
  const items = Object.values(agg).map(it => {
    const avg = it.ratings.reduce((a,b)=>a+b,0)/it.ratings.length;
    return {...it, avgRating: avg, count: it.ratings.length};
  });
  const maxCount = Math.max(...items.map(it=>it.count),1);
  const maxPrice = Math.max(...items.map(it=>it.price),1);
  const maxRating = Math.max(...items.map(it=>it.avgRating),1);

  items.forEach(it => {
    const nr = it.avgRating / maxRating;
    const np = it.count / maxCount;
    const pInv = 1 - (it.price / maxPrice);
    it.score = weights.rating * nr + weights.pop * np + weights.price * pInv;
  });

  items.sort((a,b)=>b.score - a.score);
  return items.slice(0, topK);
}

// Render Top Recs
function renderTopRecommendations() {
  const cont = document.getElementById("topRecommendations");
  cont.innerHTML = "";
  const profile = document.getElementById("profileSelect")?.value || "balanced";
  const weights = profile === "balanced"
      ? {rating:0.6, pop:0.2, price:0.2}
      : profile === "rating"
        ? {rating:0.7, pop:0.2, price:0.1}
        : {rating:0.7, pop:0.1, price:0.2};

  const recs = computeTopRecs(weights, 12);
  recs.forEach((it, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      ${idx < 5 ? '<div class="badge">🔥 Hot</div>' : ''}
      <h3>${it.productId} — ${escapeHtml(it.productName)}</h3>
      <div><strong>Brand:</strong> ${escapeHtml(it.brand)}</div>
      <div><strong>Avg Rating:</strong> ${it.avgRating.toFixed(2)}</div>
      <div><strong>Price:</strong> $${(it.price||0).toFixed(2)}</div>
      <div class="small">(${it.count} purchases)</div>
    `;
    card.onclick = () => {
      selectedProductName = it.productName;
      document.getElementById("productNameSelect").value = selectedProductName;
      renderSimilarProducts(selectedProductName);
      renderPurchaseHistory(selectedProductName);
      showNote("noteTop", `Product "${selectedProductName}" selected as base`);
    };
    cont.appendChild(card);
  });
  showNote("noteTop", `Rendered ${recs.length} top recommendations`, true);
}

// Populate product names
function populateProductNameSelect(){
  const sel = document.getElementById("productNameSelect");
  sel.innerHTML = "";
  const ds = dataByCategory();
  const names = [...new Set(ds.map(r=>r.productName))].sort();
  names.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n; opt.textContent = n;
    sel.appendChild(opt);
  });
  if(names.length) {
    selectedProductName = names[0];
    sel.value = selectedProductName;
  }
}

// Similar products
function renderSimilarProducts(name) {
  const cont = document.getElementById("similarProducts");
  cont.innerHTML = "";
  const ds = dataByCategory();
  const base = ds.find(r=>r.productName === name);
  if(!base) {
    showNote("noteSimilar", "No base product");
    return;
  }
  const candidates = {};
  ds.forEach(r => {
    if(!candidates[r.productId]) candidates[r.productId] = {...r, ratings: []};
    candidates[r.productId].ratings.push(r.rating);
  });
  const arr = Object.values(candidates).filter(it => it.productName !== name);
  const maxPrice = Math.max(...arr.map(i=>i.price), base.price || 1);
  arr.forEach(it => {
    const avg = it.ratings.reduce((a,b)=>a+b,0)/it.ratings.length;
    const ratingSim = 1 - Math.abs(avg - base.rating)/5;
    const priceSim = 1 - Math.abs(it.price - base.price)/(maxPrice + 1e-9);
    const brandMatch = (it.brand === base.brand) ? 1 : 0;
    it.simScore = 0.5 * ratingSim + 0.35 * priceSim + 0.15 * brandMatch;
  });
  arr.sort((a,b)=>b.simScore - a.simScore);
  const top = arr.slice(0, 8);
  top.forEach(it => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${it.productId} — ${escapeHtml(it.productName)}</h3>
      <div><strong>Brand:</strong> ${escapeHtml(it.brand)}</div>
      <div><strong>Avg:</strong> ${ (it.ratings.reduce((a,b)=>a+b,0)/it.ratings.length).toFixed(2) }</div>
      <div><strong>Price:</strong> $${(it.price||0).toFixed(2)}</div>
      <div class="small">Sim: ${it.simScore.toFixed(3)}</div>
    `;
    cont.appendChild(card);
  });
  showNote("noteSimilar", `Similar products to "${name}" shown`, true);
}

// Purchase history by product name
function renderPurchaseHistory(name) {
  const tbody = document.querySelector("#purchaseHistory tbody");
  tbody.innerHTML = "";
  const ds = dataByCategory();
  const rows = ds.filter(r=>r.productName === name);
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.productId}</td>
      <td>${r.userId ?? ""}</td>
      <td>${escapeHtml(r.brand)}</td>
      <td>${r.rating.toFixed(2)}</td>
      <td>$${(r.price||0).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
  showNote("noteHistory", `History for "${name}" — ${rows.length} records`, true);
}

// Populate predict product select
function populatePredictProductSelect() {
  const sel = document.getElementById("predictProductSelect");
  sel.innerHTML = "";
  const ds = dataByCategory();
  const map = {};
  ds.forEach(r => { map[r.productId] = r.productName; });
  const keys = Object.keys(map).sort((a,b)=>parseInt(a)-parseInt(b));
  keys.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = `${k} - ${map[k]}`;
    sel.appendChild(opt);
  });
}

// KNN predict
function predictRating(userId, productId, k=5) {
  const ds = ALL;
  // build user-item map
  const U = {};
  ds.forEach(r => {
    if(!U[r.userId]) U[r.userId] = {};
    U[r.userId][r.productId] = r.rating;
  });
  if(!U[userId]) return 3.0;
  // compute similarity
  const sims = [];
  for(const u in U) {
    if(parseInt(u) === userId) continue;
    const sim = cosineSim(U[userId], U[u]);
    sims.push({u: parseInt(u), sim});
  }
  sims.sort((a,b)=>b.sim - a.sim);
  const top = sims.slice(0, k);
  let num = 0, den = 0;
  top.forEach(n => {
    const rr = U[n.u][productId];
    if(rr !== undefined) {
      num += n.sim * rr;
      den += Math.abs(n.sim);
    }
  });
  if(den === 0) {
    // fallback to average
    const ds2 = dataByCategory().filter(r => r.productId === productId);
    if(ds2.length) return ds2.reduce((a,b)=>a+b.rating,0)/ds2.length;
    return 3.0;
  }
  return num/den;
}

// cosine similarity of two rating maps (by common items)
function cosineSim(a,b) {
  let dot=0, na=0, nb=0;
  for(const pid in a) {
    if(b[pid] !== undefined) {
      dot += a[pid]*b[pid];
      na += a[pid]*a[pid];
      nb += b[pid]*b[pid];
    }
  }
  if(na===0||nb===0) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}

// Top-10 Table
function computeTop10(profileMode="balanced") {
  const ds = dataByCategory();
  const agg = {};
  ds.forEach(r => {
    if(!agg[r.productId]) agg[r.productId] = {productId:r.productId, productName:r.productName, brand:r.brand, price:r.price, ratings:[], colors:[], sizes:[]};
    agg[r.productId].ratings.push(r.rating);
    if(r.color) agg[r.productId].colors.push(r.color);
    if(r.size) agg[r.productId].sizes.push(r.size);
  });
  const items = Object.values(agg);
  const maxPrice = Math.max(...items.map(i=>i.price),1);
  const maxRating = Math.max(...items.map(i=>average(i.ratings)),1);

  let base = null;
  if(selectedProductName) {
    base = ds.find(r=>r.productName === selectedProductName);
  }

  items.forEach(it => {
    it.avgRating = average(it.ratings);
    it.color = mostCommon(it.colors);
    it.size = mostCommon(it.sizes);
    const nr = it.avgRating / (maxRating + 1e-9);
    const pInv = 1 - ( (it.price||0) / (maxPrice + 1e-9) );
    let simScore = 0;
    if(base) {
      const brandMatch = (it.brand === base.brand)?1:0;
      const diffRat = 1 - Math.abs(it.avgRating - base.rating)/5;
      const diffPrice = 1 - Math.abs(it.price - base.price)/(maxPrice + 1e-9);
      simScore = 0.5*diffRat + 0.35*diffPrice + 0.15*brandMatch;
    }
    it.sim = simScore;
    const w = profileWeights(profileMode);
    it.score = w.sim*it.sim + w.rating*nr + w.price*pInv;
  });

  items.sort((a,b)=>b.score - a.score);
  return items.slice(0, 10);
}

function profileWeights(m) {
  if(m==="balanced") return {sim:0.5, rating:0.4, price:0.1};
  if(m==="rating") return {sim:0.2, rating:0.7, price:0.1};
  if(m==="similar") return {sim:0.7, rating:0.2, price:0.1};
  return {sim:0.5, rating:0.4, price:0.1};
}

// Render Top-10 Table
function renderTop10Table() {
  const mode = document.getElementById("profileSelect").value;
  const tb = document.querySelector("#topTable tbody");
  tb.innerHTML = "";
  const list = computeTop10(mode);
  list.forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${it.productId}</td>
      <td>${escapeHtml(it.productName)}</td>
      <td>${escapeHtml(it.brand)}</td>
      <td>${it.avgRating.toFixed(2)}</td>
      <td>$${(it.price||0).toFixed(2)}</td>
      <td>${escapeHtml(it.color || "")}</td>
      <td>${escapeHtml(it.size || "")}</td>
      <td>${it.score.toFixed(4)}</td>
    `;
    tb.appendChild(tr);
  });
  showNote("noteTopTable", `Top-10 Table rendered (${list.length})`, true);
}

// Render all components
function renderAll(){
  renderTopRecommendations();
  renderSimilarProducts(selectedProductName || "");
  renderEDA();
  renderPurchaseHistory(selectedProductName || "");
  renderTop10Table();
}

// Setup events
function setupEvents() {
  document.getElementById("btnLoad").onclick = ()=> init();
  document.getElementById("fileUpload").onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const text = await file.text();
    const parsed = parseCSVFlexible(text);
    ALL = normalizeRows(parsed);
    showNote("noteData", `Loaded ${ALL.length} rows via upload`);
    renderAll();
  };
  document.getElementById("btnSimilar").onclick = () => {
    const sel = document.getElementById("productNameSelect").value;
    selectedProductName = sel;
    renderSimilarProducts(sel);
    renderPurchaseHistory(sel);
  };
  document.getElementById("btnComputeTopTable").onclick = () => {
    renderTop10Table();
  };
}

// Utility: most common
function mostCommon(arr) {
  if(!arr || arr.length===0) return "";
  const counts = {};
  arr.forEach(v => counts[v] = (counts[v]||0) + 1);
  return Object.keys(counts).reduce((a,b)=> counts[a] > counts[b] ? a : b);
}

// Escape HTML
function escapeHtml(s) {
  if(!s) return "";
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Start
init();
