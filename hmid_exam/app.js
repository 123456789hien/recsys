/* app.js — Smart Fashion Recommender (final)
   - Loads CSV from GitHub raw or upload
   - Implements: category filter, Top recs, content-based similar, EDA (by category),
     purchase history (by product name), KNN rating prediction, Top-10 table
*/

/* ---------------------------
   CONFIG: raw GitHub CSV link
   Replace with your raw URL if you keep CSV elsewhere.
   The code will auto-convert a github.com/.../blob/... link to raw.githubusercontent.com
----------------------------*/
const GITHUB_CSV = "https://github.com/123456789hien/recsys/blob/main/hmid_exam/fashion_recommender.csv";

/* ---------------------------
   STATE
----------------------------*/
let ALL = [];              // all rows
let currentCategory = "All";
let selectedProductName = null;

/* ---------------------------
   UTIL: convert GitHub URL to raw
----------------------------*/
function githubToRaw(url){
  if(!url) return null;
  if(url.includes("raw.githubusercontent.com")) return url;
  // convert: https://github.com/user/repo/blob/branch/path -> https://raw.githubusercontent.com/user/repo/branch/path
  return url.replace("https://github.com/", "https://raw.githubusercontent.com/").replace("/blob/", "/");
}

/* ---------------------------
   CSV PARSE: handles ; or , separators and decimal comma in numbers
----------------------------*/
function parseCSVFlexible(text){
  // Normalize BOM and CRLF
  text = text.replace(/^\ufeff/, "");
  const lines = text.trim().split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length < 2) return [];

  // header detect: use either semicolon or comma
  const headerRaw = lines[0];
  const sep = headerRaw.includes(";") ? ";" : ",";
  const headers = headerRaw.split(sep).map(h=>h.trim());

  // map each line
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(sep).map(c=>c.trim());
    // if columns less than headers, try smart split by ; first then ,
    if(cols.length < headers.length){
      const altSep = sep === ";" ? "," : ";";
      const alt = lines[i].split(altSep).map(c=>c.trim());
      if(alt.length >= headers.length) cols.splice(0, cols.length, ...alt);
    }
    const obj = {};
    for(let j=0;j<headers.length;j++){
      obj[headers[j]] = cols[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

/* ---------------------------
   SAFE PARSE numeric (replace comma decimal)
----------------------------*/
function toNumberSafe(v){
  if(v === null || v === undefined) return NaN;
  v = String(v).trim();
  if(v === "") return NaN;
  // if appears in scientific notation with comma, convert comma to dot
  v = v.replace(/\s/g,"");
  v = v.replace(",", ".");
  // sometimes numbers like "1,0431" or "10431" -> parseFloat
  const n = parseFloat(v);
  return isNaN(n) ? NaN : n;
}

/* ---------------------------
   LOAD CSV (auto from github raw or file upload)
----------------------------*/
async function loadCsvFromUrl(url){
  const raw = githubToRaw(url);
  if(!raw) throw new Error("No URL");
  const res = await fetch(raw);
  if(!res.ok) throw new Error("Failed to fetch CSV: " + res.status);
  const text = await res.text();
  const parsed = parseCSVFlexible(text);
  return parsed;
}

/* ---------------------------
   CONVERT parsed CSV rows to canonical internal format
   Expected headers (case sensitive from your CSV): 
   User ID;Product ID;Product Name;Brand;Category;Price;Rating/5;Color;Size
----------------------------*/
function normalizeRows(rows){
  return rows.map(r=>{
    // Accept different header names by searching keys
    // find keys (case-insensitive)
    const keys = Object.keys(r);
    const mapKey = (candidates) => {
      for(const c of candidates){
        const found = keys.find(k => k.toLowerCase().includes(c.toLowerCase()));
        if(found) return found;
      }
      return null;
    };
    const kUser = mapKey(["user id","user_id","user"]);
    const kProd = mapKey(["product id","product_id","product"]);
    const kName = mapKey(["product name","name","product_name"]);
    const kBrand = mapKey(["brand"]);
    const kCat = mapKey(["category","cat"]);
    const kPrice = mapKey(["price"]);
    const kRating = mapKey(["rating/5","rating","rating5"]);
    const kColor = mapKey(["color"]);
    const kSize = mapKey(["size"]);

    const userId = parseInt(r[kUser]) || parseInt(r[kUser]?.split(".")[0]) || NaN;
    const productId = parseInt(r[kProd]) || NaN;
    const productName = r[kName] ? String(r[kName]).trim() : "";
    const brand = r[kBrand] ? String(r[kBrand]).trim() : "";
    const category = r[kCat] ? String(r[kCat]).trim() : "";
    const price = toNumberSafe(r[kPrice]);
    const rating = toNumberSafe(r[kRating]);
    const color = r[kColor] ? String(r[kColor]).trim() : "";
    const size = r[kSize] ? String(r[kSize]).trim() : "";

    return {
      userId: isNaN(userId)? null : userId,
      productId: isNaN(productId)? null : productId,
      productName,
      brand,
      category,
      price: isNaN(price)? 0 : price,
      rating: isNaN(rating)? 0 : rating,
      color,
      size
    };
  }).filter(r=>r.productName && r.productId !== null);
}

/* ---------------------------
   UI elements
----------------------------*/
const el = {
  autoLoadBtn: () => document.getElementById("autoLoadBtn"),
  uploadCsv: () => document.getElementById("uploadCsv"),
  noteData: () => document.getElementById("noteData"),
  categoryBtns: () => document.querySelectorAll(".category-btn"),
  noteCategory: () => document.getElementById("noteCategory"),
  topRecommendations: () => document.getElementById("topRecommendations"),
  noteTop: () => document.getElementById("noteTop"),
  productNameSelect: () => document.getElementById("productNameSelect"),
  showSimilar: () => document.getElementById("showSimilar"),
  similarProducts: () => document.getElementById("similarProducts"),
  noteSimilar: () => document.getElementById("noteSimilar"),
  ratingHist: () => document.getElementById("ratingHist"),
  priceRating: () => document.getElementById("priceRating"),
  edaSummary: () => document.getElementById("edaSummary"),
  purchaseHistory: () => document.querySelector("#purchaseHistory tbody"),
  noteHistory: () => document.getElementById("noteHistory"),
  predictUserId: () => document.getElementById("predictUserId"),
  predictProductSelect: () => document.getElementById("predictProductSelect"),
  predictBtn: () => document.getElementById("predictBtn"),
  predictResult: () => document.getElementById("predictResult"),
  profileSelect: () => document.getElementById("profileSelect"),
  computeTopTable: () => document.getElementById("computeTopTable"),
  topTableBody: () => document.querySelector("#topTable tbody"),
  noteTopTable: () => document.getElementById("noteTopTable")
};

/* ---------------------------
   RENDER HELPERS
----------------------------*/
function showNote(elm, text, soonClear=false){
  elm().innerText = text;
  if(soonClear){
    setTimeout(()=> elm().innerText = "", 3000);
  }
}

/* ---------------------------
   MAIN: populate UI after loading data
----------------------------*/
async function initFlow(loadFrom = GITHUB_CSV){
  try{
    showNote(el.noteData, "Loading CSV...");
    const raw = await loadCsvFromUrl(loadFrom);
    const norm = normalizeRows(raw);
    ALL = norm;
    showNote(el.noteData, `Loaded ${ALL.length} rows from CSV`, true);

    // fill category buttons note
    const cats = Array.from(new Set(ALL.map(r=>r.category).filter(Boolean)));
    showNote(el.noteCategory, `Categories found: ${cats.join(", ")}`, true);

    // init selects and displays
    setupCategoryButtons();
    populateProductNameSelect();
    populatePredictProductSelect();
    computeAndRenderAll(); // render initial
    attachEvents();
  }catch(err){
    console.error(err);
    showNote(el.noteData, "Error loading CSV. Try upload file.", false);
  }
}

/* ---------------------------
   SUPPORT file upload (override auto load)
----------------------------*/
el.uploadCsv().addEventListener("change", async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const txt = await f.text();
  const parsed = parseCSVFlexible(txt);
  const norm = normalizeRows(parsed);
  ALL = norm;
  showNote(el.noteData, `Loaded ${ALL.length} rows from uploaded CSV`, true);
  setupCategoryButtons();
  populateProductNameSelect();
  populatePredictProductSelect();
  computeAndRenderAll();
});

/* ---------------------------
   CATEGORY BUTTONS
----------------------------*/
function setupCategoryButtons(){
  document.querySelectorAll(".category-btn").forEach(b=>{
    b.onclick = ()=> {
      document.querySelectorAll(".category-btn").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      currentCategory = b.dataset.cat;
      computeAndRenderAll();
    };
  });
}

/* ---------------------------
   Helpers: filtered data by currentCategory
----------------------------*/
function dataByCategory(){
  if(currentCategory === "All") return ALL;
  return ALL.filter(r => r.category === currentCategory);
}

/* ---------------------------
   Top Recommendations (simple ranking using rating & price & popularity)
   Score = w_rating*norm_rating + w_pop*norm_popularity + w_price*(1 - norm_price)
   Popularity = number of purchases of that product in category
----------------------------*/
function computeTopRecommendations(weights = {rating:0.6, popularity:0.2, price:0.2}, topK=10){
  const ds = dataByCategory();
  // aggregate by productId
  const agg = {};
  ds.forEach(r=>{
    const id = r.productId;
    if(!agg[id]) agg[id] = {productId: id, productName: r.productName, brand:r.brand, price:r.price, ratings:[], colors:[], sizes:[]};
    agg[id].ratings.push(r.rating);
    if(r.color) agg[id].colors.push(r.color);
    if(r.size) agg[id].sizes.push(r.size);
  });
  // compute stats
  const items = Object.values(agg).map(it=>{
    const avgRating = it.ratings.length ? it.ratings.reduce((a,b)=>a+b,0)/it.ratings.length : 0;
    return {...it, avgRating, count: it.ratings.length};
  });
  // normalize helper
  const maxRating = Math.max(...items.map(i=>i.avgRating), 1);
  const minRating = Math.min(...items.map(i=>i.avgRating), 0);
  const maxCount = Math.max(...items.map(i=>i.count), 1);
  const maxPrice = Math.max(...items.map(i=>i.price||0), 1);
  // compute score
  items.forEach(it=>{
    const nr = (it.avgRating - minRating)/(maxRating - minRating + 1e-9);
    const np = it.count / (maxCount + 1e-9);
    const pInv = 1 - ( (it.price||0) / (maxPrice + 1e-9) );
    it.score = weights.rating*nr + weights.popularity*np + weights.price*pInv;
  });
  // sort
  items.sort((a,b)=>b.score - a.score);
  return items.slice(0, topK);
}

/* ---------------------------
   Render Top Recommendations cards
----------------------------*/
function renderTopRecommendations(){
  const container = el.topRecommendations();
  container.innerHTML = "";
  const weights = profileWeights(el.profileSelect().value);
  const top = computeTopRecommendations(weights, 12);
  top.forEach((it, idx)=>{
    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML = `
      ${idx<5?'<div class="badge">🔥 Hot</div>':''}
      <h3>${it.productId} — ${escapeHtml(it.productName)}</h3>
      <div><strong>Brand:</strong> ${escapeHtml(it.brand)}</div>
      <div><strong>Avg Rating:</strong> ${it.avgRating.toFixed(2)} / 5</div>
      <div><strong>Price:</strong> $${(it.price||0).toFixed(2)}</div>
      <div style="font-size:0.85rem;color:#666;margin-top:6px">
        <em>${it.count} purchases in category</em>
      </div>
    `;
    c.onclick = ()=> {
      // set selected product name and reflect in productNameSelect
      selectedProductName = it.productName;
      el.productNameSelect().value = selectedProductName;
      renderSimilarProducts(selectedProductName);
      renderPurchaseHistory(selectedProductName);
      showNote(el.noteTop, `Selected product "${selectedProductName}" for analysis`, true);
    };
    container.appendChild(c);
  });
  showNote(el.noteTop, `Top recommendations rendered (${top.length})`, true);
}

/* ---------------------------
   Content-based similar products (simple features: rating difference & price proximity & brand match)
   When user chooses a product name, we find a base sample (first match) and compute similarity to other products in same category.
----------------------------*/
function getUniqueProductNames(){
  const ds = dataByCategory();
  const names = [...new Set(ds.map(r=>r.productName))].sort();
  return names;
}

function populateProductNameSelect(){
  const sel = el.productNameSelect();
  sel.innerHTML = "";
  const names = getUniqueProductNames();
  names.forEach(n=>{
    const opt = document.createElement("option");
    opt.value = n; opt.textContent = n;
    sel.appendChild(opt);
  });
  if(names.length) {
    selectedProductName = names[0];
    sel.value = selectedProductName;
    renderSimilarProducts(selectedProductName);
    renderPurchaseHistory(selectedProductName);
  }
}

function renderSimilarProducts(name, topK=8){
  const cont = el.similarProducts();
  cont.innerHTML = "";
  const ds = dataByCategory();

  // base sample (use first matching product)
  const base = ds.find(d=>d.productName === name);
  if(!base) { showNote(el.noteSimilar, "No base product found"); return; }

  // compute similarity across productId unique
  // We'll aggregate per productId (to keep ID+name)
  const group = {};
  ds.forEach(r=>{
    if(!group[r.productId]) group[r.productId] = {...r, ratings:[]};
    group[r.productId].ratings.push(r.rating);
  });
  const entries = Object.values(group).filter(g => g.productName !== base.productName);

  // scoring: brand match (1 if same brand), rating similarity (1 - abs diff /5), price similarity (1 - abs diff / maxPrice)
  const maxPrice = Math.max(...entries.map(e=>e.price||0), base.price||1);
  entries.forEach(e=>{
    const brandMatch = (e.brand === base.brand) ? 1 : 0;
    const avgRating = e.ratings.length ? e.ratings.reduce((a,b)=>a+b,0)/e.ratings.length : 0;
    const ratingSim = 1 - Math.abs(avgRating - base.rating)/5;
    const priceSim = 1 - Math.abs((e.price||0) - (base.price||0)) / (maxPrice + 1e-9);
    e.simScore = 0.5*ratingSim + 0.35*priceSim + 0.15*brandMatch;
  });

  entries.sort((a,b)=>b.simScore - a.simScore);
  const top = entries.slice(0, topK);
  top.forEach(t=>{
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${t.productId} — ${escapeHtml(t.productName)}</h3>
      <div><b>Brand:</b> ${escapeHtml(t.brand)}</div>
      <div><b>Avg Rating:</b> ${(t.ratings.reduce((a,b)=>a+b,0)/t.ratings.length).toFixed(2)} / 5</div>
      <div><b>Price:</b> $${(t.price||0).toFixed(2)}</div>
      <div style="margin-top:6px"><b>Similarity:</b> ${t.simScore.toFixed(3)}</div>
    `;
    cont.appendChild(card);
  });
  showNote(el.noteSimilar, `Found ${top.length} similar products to "${name}"`, true);
}

/* ---------------------------
   Purchase History by Product Name
   Show all rows in the category with productName matching selected
----------------------------*/
function renderPurchaseHistory(name){
  const body = el.purchaseHistory();
  body.innerHTML = "";
  const ds = dataByCategory();
  const rows = ds.filter(r => r.productName === name);
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.productId}</td>
      <td>${r.userId ?? ""}</td>
      <td>${escapeHtml(r.brand)}</td>
      <td>${(r.rating||0).toFixed(2)}</td>
      <td>$${(r.price||0).toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });
  showNote(el.noteHistory, `Purchase history displayed (${rows.length} rows)`, true);
}

/* ---------------------------
   PREDICT RATING (User-based KNN)
   - Build user-item rating map
   - For a target user & product: find k nearest users by cosine on co-rated items
   - Aggregate weighted rating
----------------------------*/
function buildUserItemMatrix(){
  const ds = ALL;
  const users = {};
  const items = {};
  ds.forEach(r=>{
    users[r.userId] = users[r.userId] || {};
    users[r.userId][r.productId] = r.rating;
    items[r.productId] = true;
  });
  return {users, items};
}

// cosine similarity between two users (only on commonly rated items)
function cosineUserSim(uRatings, vRatings){
  let dot = 0, na = 0, nb = 0;
  for(const item in uRatings){
    if(vRatings[item] !== undefined){
      dot += uRatings[item] * vRatings[item];
      na += uRatings[item]*uRatings[item];
      nb += vRatings[item]*vRatings[item];
    }
  }
  if(na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}

function predictRatingKNN(userId, productId, k=5){
  const {users} = buildUserItemMatrix();
  if(!users[userId]) return 3.0; // cold user
  // compute similarity to other users
  const sims = [];
  for(const other in users){
    if(parseInt(other) === parseInt(userId)) continue;
    const sim = cosineUserSim(users[userId], users[other]);
    sims.push({user: other, sim});
  }
  sims.sort((a,b)=>b.sim-a.sim);
  const neighbors = sims.slice(0,k).filter(n=>n.sim>0);
  let num = 0, den = 0;
  neighbors.forEach(n=>{
    const rating = users[n.user] && users[n.user][productId];
    if(rating !== undefined){
      num += n.sim * rating;
      den += Math.abs(n.sim);
    }
  });
  if(den === 0) {
    // fallback to item avg in category
    const ds = dataByCategory().filter(r=>r.productId === productId);
    if(ds.length) return ds.reduce((a,b)=>a+b.rating,0)/ds.length;
    return 3.0;
  }
  return num/den;
}

/* ---------------------------
   Populate product dropdown for prediction (ID - Name)
----------------------------*/
function populatePredictProductSelect(){
  const sel = el.predictProductSelect();
  sel.innerHTML = "";
  const ds = dataByCategory();
  const unique = {};
  ds.forEach(r=>{
    unique[r.productId] = r.productName;
  });
  const keys = Object.keys(unique).sort((a,b)=>parseInt(a)-parseInt(b));
  keys.forEach(k=>{
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = `${k} - ${unique[k]}`;
    sel.appendChild(opt);
  });
}

/* ---------------------------
   EDA: rating histogram & price vs rating scatter (by category)
----------------------------*/
let chartRating=null, chartScatter=null;
function renderEDA(){
  const ds = dataByCategory();
  const ratings = ds.map(r=>r.rating);
  const prices = ds.map(r=>r.price);
  // rating histogram
  const ctx1 = el.ratingHist().getContext('2d');
  if(chartRating) chartRating.destroy();
  // bucket ratings by integer
  const buckets = {};
  ratings.forEach(v=>{
    const b = Math.round(v);
    buckets[b] = (buckets[b]||0)+1;
  });
  const labels = Object.keys(buckets).sort((a,b)=>a-b);
  const dataSet = labels.map(l=>buckets[l]);
  chartRating = new Chart(ctx1, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Rating counts', data: dataSet, backgroundColor:'#ffc0da' }]},
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });

  // price vs rating scatter
  const ctx2 = el.priceRating().getContext('2d');
  if(chartScatter) chartScatter.destroy();
  chartScatter = new Chart(ctx2, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Price vs Rating',
        data: ds.map(r=>({x: r.price, y: r.rating})),
        backgroundColor: '#ff66b2'
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{x:{title:{display:true,text:'Price ($)'}}, y:{title:{display:true,text:'Rating'}}}
    }
  });

  // summary
  const avgPrice = (prices.length? (prices.reduce((a,b)=>a+b,0)/prices.length):0);
  const avgRating = (ratings.length? (ratings.reduce((a,b)=>a+b,0)/ratings.length):0);
  el.edaSummary().innerText = `Category: ${currentCategory} — Products: ${ds.length} — Avg price: $${avgPrice.toFixed(2)} — Avg rating: ${avgRating.toFixed(2)}.`;
}

/* ---------------------------
   Top-10 Table (Category + optional context product influences scoring)
   Score is composed from chosen profile weights: sim to selectedProductName + avg rating normalized + price inverse normalized
----------------------------*/
function profileWeights(mode){
  if(mode === "balanced") return {sim:0.5, rating:0.4, price:0.1};
  if(mode === "rating") return {sim:0.2, rating:0.7, price:0.1};
  if(mode === "similar") return {sim:0.7, rating:0.2, price:0.1};
  return {sim:0.5, rating:0.4, price:0.1};
}

function computeTop10Table(profileMode="balanced", contextProductName=null){
  const ds = dataByCategory();
  // aggregate by product id
  const agg = {};
  ds.forEach(r=>{
    const id = r.productId;
    if(!agg[id]) agg[id] = {productId:id, productName:r.productName, brand:r.brand, ratings:[], colors:[], sizes:[], price:r.price};
    agg[id].ratings.push(r.rating);
    if(r.color) agg[id].colors.push(r.color);
    if(r.size) agg[id].sizes.push(r.size);
  });
  const items = Object.values(agg);
  // norms
  const maxPrice = Math.max(...items.map(i=>i.price||0),1);
  const maxRating = Math.max(...items.map(i=> average(i.ratings) ),1);
  // context vector: choose base item (first match)
  let base = null;
  if(contextProductName){
    base = ds.find(d=>d.productName === contextProductName);
  }
  // compute sim (if base exists): combine rating difference & price proximity & brand match
  items.forEach(it=>{
    it.avgRating = it.ratings.length ? average(it.ratings) : 0;
    it.color = mostCommon(it.colors) || "";
    it.size = mostCommon(it.sizes) || "";
    const ratingNorm = it.avgRating / (maxRating + 1e-9);
    const priceInv = 1 - ((it.price||0) / (maxPrice + 1e-9));
    let sim = 0;
    if(base){
      const brandMatch = (it.brand === base.brand)?1:0;
      const ratingSim = 1 - Math.abs(it.avgRating - base.rating)/5;
      const priceSim = 1 - Math.abs((it.price||0) - (base.price||0)) / (maxPrice + 1e-9);
      sim = 0.5*ratingSim + 0.35*priceSim + 0.15*brandMatch;
    }
    it.sim = sim;
    it.normRating = ratingNorm;
    it.normPriceInv = priceInv;
  });
  // combine per profile
  const w = profileWeights(profileMode);
  items.forEach(it=>{
    it.score = w.sim * it.sim + w.rating * it.normRating + w.price * it.normPriceInv;
  });
  items.sort((a,b)=>b.score - a.score);
  return items.slice(0,10);
}

/* ---------------------------
   UTIL: average & mostCommon & escapeHtml
----------------------------*/
function average(arr){ if(!arr||!arr.length) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }
function mostCommon(arr){
  if(!arr||!arr.length) return null;
  const counts = arr.reduce((m,x)=>{ m[x] = (m[x]||0)+1; return m; }, {});
  return Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
}
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------------------------
   Render Top-10 Table
----------------------------*/
function renderTop10Table(){
  const mode = el.profileSelect().value;
  const tbl = el.topTableBody();
  tbl.innerHTML = "";
  const items = computeTop10Table(mode, selectedProductName);
  items.forEach((it, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${it.productId}</td>
      <td>${escapeHtml(it.productName)}</td>
      <td>${escapeHtml(it.brand)}</td>
      <td>${it.avgRating.toFixed(2)}</td>
      <td>$${(it.price||0).toFixed(2)}</td>
      <td>${escapeHtml(it.color)}</td>
      <td>${escapeHtml(it.size)}</td>
      <td>${it.score.toFixed(4)}</td>
    `;
    tbl.appendChild(tr);
  });
  showNote(el.noteTopTable, `Top-10 table computed (${items.length})`, true);
}

/* ---------------------------
   Buttons & Events wiring
----------------------------*/
function attachEvents(){
  el.autoLoadBtn().onclick = ()=> {
    initFlow(GITHUB_CSV); // reload from default
  };
  el.showSimilar().onclick = ()=>{
    const name = el.productNameSelect().value;
    selectedProductName = name;
    renderSimilarProducts(name);
    renderPurchaseHistory(name);
  };
  el.predictBtn().onclick = ()=>{
    const uid = parseInt(el.predictUserId().value);
    const pid = parseInt(el.predictProductSelect().value);
    if(!uid || !pid){ el.predictResult().innerText = "Enter User ID and select product."; return; }
    const pred = predictRatingKNN(uid, pid, 5);
    el.predictResult().innerText = `Predicted rating of User ${uid} on product ${pid}: ${pred.toFixed(2)} / 5`;
  };
  el.computeTopTable().onclick = ()=> renderTop10Table();

  // when category changes, we must repopulate name and prediction product selects
  document.querySelectorAll(".category-btn").forEach(b=>{
    b.addEventListener("click", ()=>{
      populateProductNameSelect();
      populatePredictProductSelect();
      renderEDA();
      renderTopRecommendations();
      renderSimilarProducts(selectedProductName || el.productNameSelect().value || "");
    });
  });
}

/* ---------------------------
   convenience: populate productName and predict product selects according to category
----------------------------*/
function populateProductNameSelect(){
  const sel = el.productNameSelect();
  sel.innerHTML = "";
  const names = getNamesByCategory();
  names.forEach(n=>{
    const opt = document.createElement("option");
    opt.value = n; opt.textContent = n;
    sel.appendChild(opt);
  });
  if(names.length){
    selectedProductName = names[0];
    sel.value = selectedProductName;
    renderSimilarProducts(selectedProductName);
    renderPurchaseHistory(selectedProductName);
  }
}

function getNamesByCategory(){
  const ds = dataByCategory();
  return [...new Set(ds.map(r=>r.productName))].sort();
}

function populatePredictProductSelect(){
  const sel = el.predictProductSelect();
  sel.innerHTML = "";
  const ds = dataByCategory();
  const map = {};
  ds.forEach(r=> map[r.productId] = r.productName);
  const keys = Object.keys(map).sort((a,b)=>parseInt(a)-parseInt(b));
  keys.forEach(k=>{
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = `${k} - ${map[k]}`;
    sel.appendChild(opt);
  });
}

/* ---------------------------
   Kick-off: compute + render everything
----------------------------*/
function computeAndRenderAll(){
  populateProductNameSelect();
  populatePredictProductSelect();
  renderTopRecommendations();
  renderSimilarProducts(selectedProductName || el.productNameSelect().value || "");
  renderEDA();
  renderPurchaseHistory(selectedProductName || el.productNameSelect().value || "");
  renderTop10Table();
}

/* ---------------------------
   Initial auto-load (from provided GitHub)
----------------------------*/
initFlow(GITHUB_CSV);
