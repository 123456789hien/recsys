/* app.js
   Smart Fashion Recommender — Two-Tower (mocked) client-side implementation
   UPDATED: normalize similarity + rating + price before combining.
   Final RankScore = 0.4 * simNorm + 0.4 * ratingNorm + 0.2 * (1 - priceNorm)
*/

/* ============== CONFIG ============== */
/* Set your raw CSV URL here for Auto-load if you want "Auto-load" to work */
const dataUrl = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/hien_midtermexam/fashion_recommender.csv";
const AUTOLOAD_URL = dataUrl;

/* ============== STATE ============== */
let data = [];          // normalized rows list
let category = "All";   // current category scope
let currentProductName = ""; // selected product name
let productEmbeddings = new Map(); // productId -> embedding (array)
const EMB_DIM = 16;     // embedding dimensionality for mocked Two-Tower

/* ============== UTIL: CSV parsing & numeric parsing ============== */
function parseCSVText(text) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  const delim = firstLine.includes(";") ? ";" : ",";
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split(delim).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const parts = line.split(delim).map(p => p.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = parts[i] !== undefined ? parts[i].trim() : ""; });
    return obj;
  });
  return rows;
}

function toNumber(value) {
  if (value === null || value === undefined) return NaN;
  let s = String(value).replace(/\s/g, "");
  if (s.indexOf(",") !== -1 && s.indexOf(".") !== -1) {
    s = s.replace(/,/g, "");
  } else if (s.indexOf(",") !== -1 && s.indexOf(".") === -1) {
    s = s.replace(",", ".");
  }
  // drop $ if present
  s = s.replace(/\$/g, "");
  const n = Number(s);
  return isNaN(n) ? NaN : n;
}

/* Deterministic hash -> [0,1) function */
function hashTo01(str) {
  if (!str) return 0;
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return (h >>> 0) / 4294967295;
}

/* Deterministic embedding generator from a string (productId or user key) */
function embeddingFromString(key, dim = EMB_DIM) {
  const emb = new Array(dim);
  for (let i = 0; i < dim; i++) {
    const val = hashTo01(`${key}::${i}`);
    emb[i] = val * 2 - 1; // map to [-1,1]
  }
  return emb;
}

/* vector helpers */
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}
function cosineVec(a,b) {
  const da = dot(a,b);
  const na = norm(a), nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return da / (na * nb);
}

/* normalize numeric (min-max) with safe guards */
function normalizeVal(v, min, max) {
  if (v === null || v === undefined || isNaN(v)) return 0;
  if (max === min) return 0.5;
  return (v - min) / (max - min);
}

/* escape HTML */
function escapeHtml(text) {
  return (""+text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============== UI elements ============== */
const fileInput = document.getElementById("fileUpload");
const btnAuto = document.getElementById("btnAutoLoad");
const loadNote = document.getElementById("loadNote");
const catNote = document.getElementById("catNote");
const topNotes = document.getElementById("topNotes");
const simNote = document.getElementById("simNote");
const historyNote = document.getElementById("historyNote");

fileInput.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const txt = await f.text();
    handleRawCSV(txt);
    loadNote.innerText = `✅ Loaded from file: ${f.name}`;
  } catch (err) {
    console.error(err);
    loadNote.innerText = `❌ Failed to read file: ${err.message}`;
  }
});

btnAuto.addEventListener("click", async () => {
  if (!AUTOLOAD_URL) {
    alert("Auto-load URL not configured. Upload a local CSV instead.");
    return;
  }
  try {
    const resp = await fetch(AUTOLOAD_URL);
    if (!resp.ok) throw new Error("Network response not ok");
    const txt = await resp.text();
    handleRawCSV(txt);
    loadNote.innerText = `✅ Auto-loaded from GitHub URL`;
  } catch (err) {
    console.error(err);
    loadNote.innerText = `❌ Auto-load failed: ${err.message}`;
  }
});

/* ============== PROCESS RAW CSV ============== */
function handleRawCSV(text) {
  const rows = parseCSVText(text);
  if (rows.length === 0) {
    loadNote.innerText = "❌ Empty or invalid CSV.";
    return;
  }

  // detect headers and map to canonical keys (case-insensitive)
  const headerMap = {};
  const sampleHeaders = Object.keys(rows[0]);
  sampleHeaders.forEach(h => {
    const key = h.toLowerCase();
    if (key.includes("user")) headerMap.user = h;
    if (key.includes("product id") || key === "productid" || key.includes("stockcode") || key.includes("productid")) headerMap.productId = h;
    if (key.includes("product name") || key.includes("description") || key.includes("name")) headerMap.name = h;
    if (key.includes("brand")) headerMap.brand = h;
    if (key.includes("category")) headerMap.category = h;
    if (key.includes("price") || key.includes("unitprice")) headerMap.price = h;
    if (key.includes("rating")) headerMap.rating = h;
    if (key.includes("color")) headerMap.color = h;
    if (key.includes("size")) headerMap.size = h;
  });

  if (!headerMap.productId) headerMap.productId = sampleHeaders[1] || sampleHeaders[0];
  if (!headerMap.name) headerMap.name = sampleHeaders[2] || sampleHeaders[1] || sampleHeaders[0];
  if (!headerMap.rating) headerMap.rating = sampleHeaders[sampleHeaders.length - 2] || sampleHeaders[sampleHeaders.length - 1];

  // map and normalize category names
  data = rows.map(r => {
    const o = {};
    o.user = (r[headerMap.user] || "").toString().trim();
    o.productId = (r[headerMap.productId] || "").toString().trim();
    o.name = (r[headerMap.name] || "").toString().trim();
    o.brand = (r[headerMap.brand] || "").toString().trim();
    o.category = (r[headerMap.category] || "").toString().trim();

    const catNorm = o.category ? o.category.toLowerCase() : "";
    if (/women|female|ladies|womens?/i.test(catNorm)) o.category = "Women's Fashion";
    else if (/men|male|mens?/i.test(catNorm)) o.category = "Men's Fashion";
    else if (/kid|child|children|boys|girls/i.test(catNorm)) o.category = "Kids' Fashion";
    else if (!o.category) o.category = "Unspecified";

    o.price = toNumber(r[headerMap.price]);
    if (isNaN(o.price)) o.price = null;
    o.rating = toNumber(r[headerMap.rating]);
    if (isNaN(o.rating)) o.rating = null;
    o.color = (r[headerMap.color] || "").toString().trim() || "-";
    o.size = (r[headerMap.size] || "").toString().trim() || "-";
    return o;
  });

  // build product embeddings (deterministic)
  productEmbeddings.clear();
  data.forEach(d => {
    if (d.productId) {
      productEmbeddings.set(d.productId, embeddingFromString(`prod:${d.productId}`));
    }
  });

  const total = data.length;
  const missingPrice = data.filter(d => d.price === null).length;
  const missingRating = data.filter(d => d.rating === null).length;
  loadNote.innerHTML = `✅ Loaded ${total} rows — missing price: ${missingPrice}, missing rating: ${missingRating}`;

  initAfterLoad();
}

/* ============== UI SETUP AFTER DATA LOAD ============== */
const catButtons = document.querySelectorAll(".cat-btn");
const topRecsDiv = document.getElementById("topRecs");
const productNameSelect = document.getElementById("productNameSelect");
const similarGrid = document.getElementById("similarGrid");
const historyTableBody = document.querySelector("#historyTable tbody");
const tableByRatingBody = document.querySelector("#tableByRating tbody");
const tableByScoreBody = document.querySelector("#tableByScore tbody");

let chartRating = null, chartPrice = null, chartScatter = null, chartBrand = null;

function initAfterLoad() {
  catButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      catButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      category = btn.dataset.cat;
      catNote.innerText = `Category: ${category}`;
      refreshAll();
    });
  });

  productNameSelect.addEventListener("change", () => {
    currentProductName = productNameSelect.value || "";
  });

  document.getElementById("btnShowSimilar").addEventListener("click", showSimilarProducts);

  refreshAll();
}

/* ============== CORE: get filtered data (fixed token matching) ============== */
function getFilteredData() {
  if (!data || data.length === 0) return [];
  if (!category || category === "All") return data.slice();
  const exact = data.filter(d => d.category === category);
  if (exact.length) return exact;
  const targetLower = category.toLowerCase();
  const ci = data.filter(d => (d.category || "").toLowerCase() === targetLower);
  if (ci.length) return ci;
  const targetTokens = normalizeCategoryString(category).split(" ").filter(t => t.length > 1);
  if (targetTokens.length === 0) return data.slice();
  return data.filter(d => {
    const dTokens = normalizeCategoryString(d.category || "").split(" ").filter(t => t.length > 1);
    return targetTokens.every(t => dTokens.includes(t));
  });
}

function normalizeCategoryString(s) {
  if (!s && s !== 0) return "";
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/* ============== MAIN REFRESH ============== */
function refreshAll() {
  const filtered = getFilteredData();
  renderTopRecommendations(filtered);
  renderEDA(filtered);
  populateProductNameSelect(filtered);
  clearSimilarAndHistory();
  renderTop10Tables(filtered);
}

/* ============== TOP RECOMMENDATIONS (Two-Tower mock but with normalized similarity) ============== */
/* New: we compute raw similarity for each item, then normalize similarity across the filtered set (min-max),
   then combine:
     finalScore = 0.4 * simNorm + 0.4 * ratingNorm + 0.2 * (1 - priceNorm)
   This ensures rating high + price low are prioritized.
*/

function buildSessionUserEmbedding() {
  // Session key: combine chosen category and a stable token
  const key = `session::${category}`;
  return embeddingFromString(key);
}

function renderTopRecommendations(filtered) {
  topRecsDiv.innerHTML = "";
  if (!filtered.length) {
    topRecsDiv.innerHTML = `<div class="note small">No items in this category.</div>`;
    topNotes.innerText = "";
    return;
  }

  // compute min/max for rating and price to allow normalization
  const ratings = filtered.map(d => d.rating).filter(v => v !== null && !isNaN(v));
  const prices = filtered.map(d => d.price).filter(v => v !== null && !isNaN(v));
  const minR = ratings.length ? Math.min(...ratings) : 0;
  const maxR = ratings.length ? Math.max(...ratings) : 5;
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 1;

  // user embedding and raw sim computation
  const userEmb = buildSessionUserEmbedding();
  const temp = filtered.map(d => {
    const itemEmb = productEmbeddings.get(d.productId) || embeddingFromString(`prod:${d.productId}`);
    const rawSim = cosineVec(userEmb, itemEmb); // in [-1,1] typically
    return {...d, rawSim, rating: d.rating, price: d.price};
  });

  // normalize rawSim to [0,1] via min-max across this filtered set
  const sims = temp.map(t => t.rawSim);
  const minSim = Math.min(...sims), maxSim = Math.max(...sims);

  const scored = temp.map(t => {
    const simNorm = normalizeVal(t.rawSim, minSim, maxSim); // 0..1
    const ratingNorm = normalizeVal(t.rating, minR, maxR);
    const priceNorm = normalizeVal(t.price, minP, maxP);
    const finalScore = 0.4 * simNorm + 0.4 * ratingNorm + 0.2 * (1 - priceNorm);
    return {...t, simNorm, ratingNorm, priceNorm, finalScore};
  });

  const sorted = scored.slice().sort((a,b)=>b.finalScore - a.finalScore).slice(0,8);
  sorted.forEach((p, idx) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="badge-hot">🔥 Rank ${(idx+1)}</div>
      <h3>${escapeHtml(p.productId)} — ${escapeHtml(p.name)}</h3>
      <div><strong>${escapeHtml(p.brand)}</strong></div>
      <div>⭐ ${p.rating===null? "—":p.rating.toFixed(2)} &nbsp; | &nbsp; $${p.price===null? "—":p.price.toFixed(2)}</div>
    `;
    card.title = `Score: ${p.finalScore.toFixed(3)} · Sim: ${p.simNorm.toFixed(3)} · Color: ${p.color} · Size: ${p.size}`;
    topRecsDiv.appendChild(card);
  });

  topNotes.innerText = `Showing ${sorted.length} top items for category "${category}".`;
}

/* ============== EDA (Chart.js) ============== */
function renderEDA(filtered) {
  const ratings = filtered.map(d => (d.rating === null ? null : d.rating)).filter(v => v !== null);
  const prices = filtered.map(d => (d.price === null ? null : d.price)).filter(v => v !== null);

  const ctxR = document.getElementById("chartRating").getContext("2d");
  if (chartRating) chartRating.destroy();
  chartRating = new Chart(ctxR, {
    type: 'bar',
    data: { labels: getBuckets(ratings,10).labels, datasets: [{ label: 'Count', data: getBuckets(ratings,10).counts, backgroundColor: '#ff99cc' }] },
    options: { plugins:{title:{display:true,text:`Rating distribution (${category})`}}, responsive:true }
  });

  const ctxP = document.getElementById("chartPrice").getContext("2d");
  if (chartPrice) chartPrice.destroy();
  const pb = getBuckets(prices,10);
  chartPrice = new Chart(ctxP, {
    type: 'bar',
    data: { labels: pb.labels, datasets: [{ label: 'Count', data: pb.counts, backgroundColor: '#ffb3d9' }] },
    options: { plugins:{title:{display:true,text:`Price distribution (${category})`}}, responsive:true }
  });

  const ctxS = document.getElementById("chartScatter").getContext("2d");
  if (chartScatter) chartScatter.destroy();
  chartScatter = new Chart(ctxS, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Price vs Rating',
        data: filtered.filter(d => d.price !== null && d.rating !== null).map(d => ({x:d.price,y:d.rating,meta:`${d.name} (${d.productId})`})),
        pointBackgroundColor: '#ff66b2'
      }]
    },
    options: {
      plugins:{title:{display:true,text:`Price vs Rating (${category})`}, tooltip:{callbacks:{label:ctx=>`Price: $${ctx.raw.x}, Rating: ${ctx.raw.y}\n${ctx.raw.meta}`}}},
      scales:{x:{title:{display:true,text:'Price ($)'}}, y:{title:{display:true,text:'Rating'}}},
      responsive:true
    }
  });

  const ctxB = document.getElementById("chartBrand").getContext("2d");
  if (chartBrand) chartBrand.destroy();
  const brandStats = aggregateBy(filtered,"brand",d=>d.rating).filter(b=>!isNaN(b.avg));
  brandStats.sort((a,b)=>b.avg - a.avg);
  chartBrand = new Chart(ctxB, {
    type:'bar',
    data: { labels: brandStats.map(b=>b.key), datasets: [{ label:'Avg Rating', data: brandStats.map(b=>b.avg), backgroundColor:'#ff80bf' }]},
    options: { plugins:{title:{display:true,text:`Average Rating per Brand (${category})`}}, responsive:true }
  });
}

/* helpers for buckets & aggregate */
function getBuckets(values, nBuckets=10) {
  if (!values || values.length === 0) return {labels: [], counts: []};
  const min = Math.min(...values), max = Math.max(...values);
  if (min===max) return { labels: [`${min.toFixed(2)}`], counts: [values.length] };
  const step = (max - min) / nBuckets;
  const counts = Array(nBuckets).fill(0);
  const labels = [];
  for (let i=0;i<nBuckets;i++){
    const a = min + i*step;
    const b = a + step;
    labels.push(`${a.toFixed(2)} - ${b.toFixed(2)}`);
  }
  values.forEach(v=>{
    let idx = Math.floor((v - min)/step);
    if (idx===nBuckets) idx = nBuckets-1;
    counts[idx]++;
  });
  return {labels, counts};
}

function aggregateBy(arr, key, valueFn) {
  const map = new Map();
  arr.forEach(r=>{
    const k = (r[key] || "Unknown");
    const v = valueFn(r);
    if (!map.has(k)) map.set(k, {sum:0, count:0, key:k});
    const entry = map.get(k);
    if (v !== null && v !== undefined && !isNaN(v)) { entry.sum += v; entry.count += 1; }
  });
  const out = [];
  for (const [k,v] of map) out.push({ key: k, avg: v.count ? v.sum / v.count : NaN, count: v.count });
  return out;
}

/* ============== Product select population ============== */
function populateProductNameSelect(filtered) {
  const select = document.getElementById("productNameSelect");
  select.innerHTML = "<option value=''>-- choose product name --</option>";
  const unique = Array.from(new Set(filtered.map(d => d.name))).sort();
  unique.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    select.appendChild(opt);
  });
  simNote.innerText = unique.length ? `Choose a product name to find similar items` : "No products in category.";
}

/* clear similar & history */
function clearSimilarAndHistory() {
  similarGrid.innerHTML = "";
  historyTableBody.innerHTML = "";
  simNote.innerText = "";
  historyNote.innerText = "";
}

/* ============== Show Similar Products (cosine on embeddings) ============== */
function showSimilarProducts() {
  const productName = document.getElementById("productNameSelect").value;
  if (!productName) { alert("Please choose a product name first."); return; }
  currentProductName = productName;

  const filtered = getFilteredData();
  const targetRecords = filtered.filter(d => d.name === productName);
  if (targetRecords.length === 0) {
    simNote.innerText = "No records found for selected product in this category.";
    return;
  }
  const target = targetRecords[0];
  const targetEmb = productEmbeddings.get(target.productId) || embeddingFromString(`prod:${target.productId}`);

  // candidates: same product name first (different productId), else all others
  const candidates = filtered.filter(d => d.name === productName && d.productId !== target.productId);
  const scope = candidates.length ? candidates : filtered.filter(d => d.productId !== target.productId);

  const sims = scope.map(c => {
    const emb = productEmbeddings.get(c.productId) || embeddingFromString(`prod:${c.productId}`);
    const s = cosineVec(targetEmb, emb);
    return {...c, similarity: s};
  }).sort((a,b)=>b.similarity - a.similarity).slice(0,10);

  similarGrid.innerHTML = "";
  sims.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="badge-hot" style="background:#ff8fb3">Sim ${p.similarity.toFixed(3)}</div>
      <h3>${escapeHtml(p.productId)} — ${escapeHtml(p.name)}</h3>
      <div><strong>${escapeHtml(p.brand)}</strong></div>
      <div>⭐ ${p.rating===null? "—" : p.rating.toFixed(2)} &nbsp; | &nbsp; $${p.price===null? "—":p.price.toFixed(2)}</div>
    `;
    card.title = `Color ${p.color} · Size ${p.size} · Category ${p.category}`;
    similarGrid.appendChild(card);
  });

  simNote.innerText = `Found ${sims.length} similar items for "${productName}" in category ${category}.`;
  renderPurchaseHistory(productName);
  const scoped = filtered.filter(d => d.name === productName);
  if (scoped.length) renderTop10Tables(scoped);
}

/* ============== Purchase history ============== */
function renderPurchaseHistory(productName) {
  const filtered = getFilteredData().filter(d => d.name === productName);
  historyTableBody.innerHTML = "";
  if (!filtered.length) {
    historyNote.innerText = "No purchase history for this product in current category.";
    return;
  }
  filtered.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(row.productId)}</td><td>${escapeHtml(row.user)}</td><td>${escapeHtml(row.brand)}</td><td>${row.rating===null? "—" : row.rating.toFixed(2)}</td><td>${row.price===null ? "—" : "$"+row.price.toFixed(2)}</td>`;
    historyTableBody.appendChild(tr);
  });
  historyNote.innerText = `Displayed ${filtered.length} purchase records for "${productName}"`;
}

/* ============== Top-10 Tables (Rating & Two-Tower Score) ============== */
function renderTop10Tables(filtered) {
  // Top by rating
  const byRating = filtered.slice().filter(d => d.rating !== null).sort((a,b)=>b.rating - a.rating).slice(0,10);
  tableByRatingBody.innerHTML = "";
  byRating.forEach((p,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(p.productId)}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${escapeHtml(p.brand)}</td><td>${p.rating===null? "—":p.rating.toFixed(2)}</td><td>${p.price===null? "—":"$"+p.price.toFixed(2)}</td><td>${escapeHtml(p.color)}</td><td>${escapeHtml(p.size)}</td>`;
    tableByRatingBody.appendChild(tr);
  });

  // Top by model score (Two-Tower mock, normalized similarity + rating/price)
  // compute normalization params
  const ratings = filtered.map(d => d.rating).filter(v => v !== null && !isNaN(v));
  const prices = filtered.map(d => d.price).filter(v => v !== null && !isNaN(v));
  const minR = ratings.length ? Math.min(...ratings) : 0;
  const maxR = ratings.length ? Math.max(...ratings) : 5;
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 1;

  const userEmb = buildSessionUserEmbedding();
  const temp = filtered.map(d => {
    const emb = productEmbeddings.get(d.productId) || embeddingFromString(`prod:${d.productId}`);
    const rawSim = cosineVec(userEmb, emb);
    return {...d, rawSim};
  });

  const simVals = temp.map(t => t.rawSim);
  const minSim = Math.min(...simVals), maxSim = Math.max(...simVals);

  const scored = temp.map(t => {
    const simNorm = normalizeVal(t.rawSim, minSim, maxSim);
    const ratingNorm = normalizeVal(t.rating, minR, maxR);
    const priceNorm = normalizeVal(t.price, minP, maxP);
    const finalScore = 0.4 * simNorm + 0.4 * ratingNorm + 0.2 * (1 - priceNorm);
    return {...t, finalScore};
  });

  const topByScore = scored.sort((a,b)=>b.finalScore - a.finalScore).slice(0,10);
  tableByScoreBody.innerHTML = "";
  topByScore.forEach((p,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(p.productId)}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${escapeHtml(p.brand)}</td><td>${p.rating===null?"—":p.rating.toFixed(2)}</td><td>${p.price===null?"—":"$"+p.price.toFixed(2)}</td><td>${escapeHtml(p.color)}</td><td>${escapeHtml(p.size)}</td><td>${p.finalScore.toFixed(3)}</td>`;
    tableByScoreBody.appendChild(tr);
  });
}

/* ============== Helpers & Init ============== */
(function initEmpty() {
  loadNote.innerText = "Please upload your CSV file or press Auto-load (if configured in app.js).";
})();
