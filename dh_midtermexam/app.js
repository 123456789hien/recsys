/* app.js
   Smart Fashion Recommender Dashboard
   - Robust CSV parsing (semicolon or comma)
   - Decimal comma handling
   - Category scope, EDA, cosine similarity, top lists
   - Fixes: AUTOLOAD_URL, robust category matching (Men's != Women's),
            added Category column in top tables,
            deterministic diversity (hashTo01) and price inversion for cheaper preference.
*/

/* ============== CONFIG ============== */
/* Set your raw CSV URL here for Auto-load */
const dataUrl = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/midexam_dhien/fashion_recommender.csv";
const AUTOLOAD_URL = dataUrl;

/* ============== STATE ============== */
let data = [];          // array of normalized rows
let category = "All";   // current category
let currentProductName = ""; // current product selection

/* ============== UTILITY: parsing CSV robustly ============== */
function parseCSVText(text) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  const delim = firstLine.includes(";") ? ";" : ",";
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split(delim).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const parts = line.split(delim).map(p => p.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = parts[i] !== undefined ? parts[i].trim() : "";
    });
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
  const n = Number(s);
  return isNaN(n) ? NaN : n;
}

/* deterministic pseudo-random [0,1) from string (FNV-like) */
function hashTo01(str) {
  if (!str) return 0;
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return (h >>> 0) / 4294967295;
}

/* normalize helper (min-max) */
function normalizeVal(v, min, max) {
  if (v === null || v === undefined || isNaN(v)) return 0;
  if (max === min) return 0.5;
  return (v - min) / (max - min);
}

/* normalize category strings for token-based matching */
function normalizeCategoryString(s) {
  if (!s && s !== 0) return "";
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/* ============== DATA LOAD UI ============== */
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
    alert("Auto-load URL not configured in app.js. You can upload a local CSV instead.");
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

/* ============== PROCESS RAW CSV TEXT ============== */
function handleRawCSV(text) {
  const rows = parseCSVText(text);
  if (rows.length === 0) {
    loadNote.innerText = "❌ Empty or invalid CSV.";
    return;
  }

  // detect headers and map
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

  // fallbacks
  if (!headerMap.productId) headerMap.productId = sampleHeaders[1] || sampleHeaders[0];
  if (!headerMap.name) headerMap.name = sampleHeaders[2] || sampleHeaders[1] || sampleHeaders[0];
  if (!headerMap.rating) headerMap.rating = sampleHeaders[sampleHeaders.length - 2] || sampleHeaders[sampleHeaders.length - 1];

  // map rows
  data = rows.map(r => {
    const o = {};
    o.user = (r[headerMap.user] || "").toString().trim();
    o.productId = (r[headerMap.productId] || "").toString().trim();
    o.name = (r[headerMap.name] || "").toString().trim();
    o.brand = (r[headerMap.brand] || "").toString().trim();
    o.category = (r[headerMap.category] || "").toString().trim();

    // robust normalization to main categories
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

  // info
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
  // wire category buttons
  catButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      catButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      category = btn.dataset.cat;
      catNote.innerText = `Category: ${category}`;
      refreshAll();
    });
  });

  // product select
  productNameSelect.addEventListener("change", () => {
    currentProductName = productNameSelect.value || "";
  });

  document.getElementById("btnShowSimilar").addEventListener("click", showSimilarProducts);

  // initial refresh
  refreshAll();
}

/* ============== CORE: refresh everything based on `category` ============== */
function refreshAll() {
  const filtered = getFilteredData();
  renderTopRecommendations(filtered);
  renderEDA(filtered);
  populateProductNameSelect(filtered);
  clearSimilarAndHistory();
  renderTop10Tables(filtered);
}

/* ============== FIXED filter helper (avoid substring collision like "men" inside "women") ============== */
function getFilteredData() {
  if (!data || data.length === 0) return [];
  if (!category || category === "All") return data.slice();

  // 1) Prefer exact match
  const exact = data.filter(d => d.category === category);
  if (exact.length) return exact;

  // 2) Case-insensitive exact match fallback
  const targetLower = category.toLowerCase();
  const ci = data.filter(d => (d.category || "").toLowerCase() === targetLower);
  if (ci.length) return ci;

  // 3) Token-based matching fallback (match meaningful tokens only)
  const targetTokens = normalizeCategoryString(category).split(" ").filter(t => t.length > 1);
  if (targetTokens.length === 0) return data.slice();

  return data.filter(d => {
    const dTokens = normalizeCategoryString(d.category || "").split(" ").filter(t => t.length > 1);
    return targetTokens.every(t => dTokens.includes(t));
  });
}

/* ============== TOP RECOMMENDATIONS (simple business value) ============== */
function renderTopRecommendations(filtered) {
  topRecsDiv.innerHTML = "";
  if (!filtered.length) {
    topRecsDiv.innerHTML = `<div class="note small">No items in this category.</div>`;
    topNotes.innerText = "";
    return;
  }

  const sorted = filtered.slice().filter(d => d.rating !== null).sort((a,b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    const pa = a.price || Infinity, pb = b.price || Infinity;
    return pa - pb;
  });

  const top = sorted.slice(0, 8);
  top.forEach((p, idx) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="badge-hot">🔥 Hot</div>
      <h3>${escapeHtml(p.productId)} — ${escapeHtml(p.name)}</h3>
      <div><strong>${escapeHtml(p.brand)}</strong></div>
      <div>⭐ ${p.rating === null? "—" : p.rating.toFixed(2)} &nbsp; | &nbsp; $${p.price===null? "—" : p.price.toFixed(2)}</div>
    `;
    card.title = `Color: ${p.color} · Size: ${p.size} · Category: ${p.category}`;
    topRecsDiv.appendChild(card);
  });

  topNotes.innerText = `Showing ${top.length} top items for category "${category}".`;
}

/* escape HTML small helper */
function escapeHtml(text){
  return (""+text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============== EDA charts (Chart.js) ============== */
function renderEDA(filtered) {
  const ratings = filtered.map(d => (d.rating === null ? null : d.rating)).filter(v => v !== null);
  const prices = filtered.map(d => (d.price === null ? null : d.price)).filter(v => v !== null);

  // Rating chart
  const ctxR = document.getElementById("chartRating").getContext("2d");
  if (chartRating) chartRating.destroy();
  chartRating = new Chart(ctxR, {
    type: 'bar',
    data: {
      labels: getBuckets(ratings, 10).labels,
      datasets: [{ label: 'Count', data: getBuckets(ratings, 10).counts, backgroundColor: '#ff99cc' }]
    },
    options: {
      plugins:{title:{display:true,text:`Rating distribution (${category})`}, tooltip:{callbacks:{label:ctx=>`Count: ${ctx.raw}`}}},
      responsive:true
    }
  });

  // Price histogram
  const ctxP = document.getElementById("chartPrice").getContext("2d");
  if (chartPrice) chartPrice.destroy();
  const pb = getBuckets(prices, 10);
  chartPrice = new Chart(ctxP, {
    type: 'bar',
    data: { labels: pb.labels, datasets: [{ label: 'Count', data: pb.counts, backgroundColor: '#ffb3d9' }]},
    options: { plugins:{title:{display:true,text:`Price distribution (${category})`}}, responsive:true }
  });

  // Scatter Price vs Rating
  const ctxS = document.getElementById("chartScatter").getContext("2d");
  if (chartScatter) chartScatter.destroy();
  chartScatter = new Chart(ctxS, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Price vs Rating',
        data: filtered.filter(d => d.price !== null && d.rating !== null).map(d => ({x: d.price, y: d.rating, meta: `${d.name} (${d.productId})` })),
        pointBackgroundColor: '#ff66b2'
      }]
    },
    options: {
      plugins:{title:{display:true,text:`Price vs Rating (${category})`}, tooltip:{callbacks:{label:ctx=>`Price: $${ctx.raw.x}, Rating: ${ctx.raw.y}\n${ctx.raw.meta}`}}},
      scales:{x:{title:{display:true,text:'Price ($)'}}, y:{title:{display:true,text:'Rating'}}},
      responsive:true
    }
  });

  // Average rating per brand bar
  const ctxB = document.getElementById("chartBrand").getContext("2d");
  if (chartBrand) chartBrand.destroy();
  const brandStats = aggregateBy(filtered, "brand", d=>d.rating).filter(b=>!isNaN(b.avg));
  brandStats.sort((a,b)=>b.avg - a.avg);
  chartBrand = new Chart(ctxB, {
    type: 'bar',
    data: { labels: brandStats.map(b=>b.key), datasets: [{ label: 'Avg Rating', data: brandStats.map(b=>b.avg), backgroundColor:'#ff80bf' }]},
    options: { plugins:{title:{display:true,text:`Average Rating per Brand (${category})`}}, responsive:true }
  });
}

/* buckets helper for histograms */
function getBuckets(values, nBuckets=10){
  if (!values || values.length===0) return {labels:[],counts:[]};
  const min = Math.min(...values), max = Math.max(...values);
  if (min===max) {
    return { labels: [`${min.toFixed(2)}`], counts: [values.length] };
  }
  const step = (max - min) / nBuckets;
  const counts = Array(nBuckets).fill(0);
  const labels = [];
  for (let i=0;i<nBuckets;i++){
    const a = min + i*step;
    const b = a + step;
    labels.push(`${a.toFixed(2)} - ${b.toFixed(2)}`);
  }
  values.forEach(v=>{
    let idx = Math.floor((v - min) / step);
    if (idx===nBuckets) idx = nBuckets-1;
    counts[idx]++;
  });
  return {labels, counts};
}

/* aggregate helper */
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
  for (const [k,v] of map) {
    out.push({ key: k, avg: v.count ? v.sum / v.count : NaN, count: v.count });
  }
  return out;
}

/* ============== PRODUCT SELECT (Product Name) ============== */
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
  simNote.innerText = unique.length ? `Choose a product name to find similar items (same product type)` : "No products in category.";
}

/* clear similar and history when category changes */
function clearSimilarAndHistory() {
  similarGrid.innerHTML = "";
  historyTableBody.innerHTML = "";
  simNote.innerText = "";
  historyNote.innerText = "";
}

/* ============== SHOW SIMILAR PRODUCTS (cosine on normalized [rating, price]) ============== */
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

  // normalization params (category scoped)
  const ratings = filtered.map(d => d.rating).filter(v => v !== null && !isNaN(v));
  const prices = filtered.map(d => d.price).filter(v => v !== null && !isNaN(v));
  const ratingMin = ratings.length ? Math.min(...ratings) : 0;
  const ratingMax = ratings.length ? Math.max(...ratings) : 5;
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 1;

  function norm(val, min, max) {
    if (val === null || isNaN(val)) return 0;
    if (max === min) return 0.5;
    return (val - min) / (max - min);
  }

  const candidates = filtered.filter(d => d.name === productName && d.productId !== target.productId);
  const scopeCandidates = candidates.length ? candidates : filtered.filter(d => d.productId !== target.productId);

  const tv = [norm(target.rating, ratingMin, ratingMax), norm(target.price, priceMin, priceMax)];
  const sims = scopeCandidates.map(c => {
    const cv = [norm(c.rating, ratingMin, ratingMax), norm(c.price, priceMin, priceMax)];
    const sim = cosine(tv, cv);
    return {...c, similarity: sim};
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
    card.title = `User view: Color ${p.color} · Size ${p.size}`;
    similarGrid.appendChild(card);
  });

  simNote.innerText = `Found ${sims.length} similar items for "${productName}" in category ${category}.`;
  renderPurchaseHistory(productName);
  const scoped = filtered.filter(d => d.name === productName);
  if (scoped.length) renderTop10Tables(scoped);
}

/* cosine helper */
function cosine(a,b){
  const dot = (a[0]*b[0] + a[1]*b[1]);
  const magA = Math.sqrt(a[0]*a[0] + a[1]*a[1]);
  const magB = Math.sqrt(b[0]*b[0] + b[1]*b[1]);
  if (magA===0 || magB===0) return 0;
  return dot/(magA*magB);
}

/* ============== Purchase history by product name ============== */
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

/* ============== Top-10 Tables (rating & score) ============== */
function renderTop10Tables(filtered) {
  // Top by rating
  const byRating = filtered.slice().filter(d => d.rating !== null).sort((a,b)=>b.rating - a.rating).slice(0,10);
  tableByRatingBody.innerHTML = "";
  byRating.forEach((p,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(p.productId)}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${escapeHtml(p.brand)}</td><td>${p.rating===null? "—":p.rating.toFixed(2)}</td><td>${p.price===null? "—":"$"+p.price.toFixed(2)}</td><td>${escapeHtml(p.color)}</td><td>${escapeHtml(p.size)}</td>`;
    tableByRatingBody.appendChild(tr);
  });

  // Score: normalization within current filtered set
  const ratings = filtered.map(d => d.rating).filter(v=>v!==null && !isNaN(v));
  const prices = filtered.map(d => d.price).filter(v=>v!==null && !isNaN(v));
  const rmin = ratings.length ? Math.min(...ratings) : 0, rmax = ratings.length ? Math.max(...ratings) : 1;
  const pmin = prices.length ? Math.min(...prices) : 0, pmax = prices.length ? Math.max(...prices) : 1;

  const scored = filtered.map(p => {
    const nr = normalizeVal(p.rating, rmin, rmax);
    const np = normalizeVal(p.price, pmin, pmax);
    const diversity = hashTo01(p.productId);
    const score = 0.5*nr + 0.3*(1 - np) + 0.2*diversity; // prefer high rating, low price, deterministic diversity
    return {...p, score};
  }).sort((a,b)=>b.score - a.score).slice(0,10);

  tableByScoreBody.innerHTML = "";
  scored.forEach((p,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(p.productId)}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${escapeHtml(p.brand)}</td><td>${p.rating===null?"—":p.rating.toFixed(2)}</td><td>${p.price===null?"—":"$"+p.price.toFixed(2)}</td><td>${escapeHtml(p.color)}</td><td>${escapeHtml(p.size)}</td><td>${p.score.toFixed(3)}</td>`;
    tableByScoreBody.appendChild(tr);
  });
}

/* ============== Helpers ============== */

// initial no-data state
(function initEmpty() {
  loadNote.innerText = "Please upload your CSV file or press Auto-load (if configured in app.js).";
})();
