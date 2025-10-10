/* app.js — Smart Fashion Recommender (final)
   - robust CSV parsing (semicolon or comma)
   - category scoping, EDA (3 charts), content-based similarity (cosine)
   - Top recommendations + Top-10 tables, purchase history
   - tooltip + hover, local upload fallback
*/

/* ---------- Config ---------- */
const RAW_CSV = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/midexam_hiendo/fashion_recommender.csv";

/* ---------- State ---------- */
let allData = [];            // raw rows loaded
let currentCategory = "All"; // selected category
let selectedProductName = ""; // selected product for similarity/history

/* ---------- DOM refs ---------- */
const loadNote = document.getElementById("loadNote");
const autoLoadBtn = document.getElementById("autoLoadBtn");
const uploadCsv = document.getElementById("uploadCsv");
const catButtons = document.querySelectorAll(".cat-btn");

const recommendationContainer = d3.select("#recommendationContainer");
const productSelect = d3.select("#productSelect");
const showSimilarBtn = document.getElementById("showSimilarBtn");
const similarContainer = d3.select("#similarContainer");
const similarNote = document.getElementById("similarNote");
const edaNote = document.getElementById("edaNote");
const historyTableBody = d3.select("#historyTable tbody");
const topRatingBody = d3.select("#topRatingTable tbody");
const topScoreBody = d3.select("#topScoreTable tbody");

/* tooltip element */
const tooltip = d3.select("body").append("div").attr("class","tooltip");

/* ---------- Helpers ---------- */

// robust CSV parsing: use d3.dsvFormat(';') if needed
async function fetchAndParseCsv(url){
  try{
    const resp = await fetch(url);
    if(!resp.ok) throw new Error("Fetch failed: " + resp.status);
    const text = await resp.text();

    // detect delimiter: semicolon or comma (prefer semicolon if present)
    const delim = text.indexOf(";") > -1 && text.indexOf(",") > -1 && text.indexOf(";") < text.indexOf(",") ? ";" : (text.indexOf(";")>-1?";":",");
    const dsv = d3.dsvFormat(delim);
    const parsed = dsv.parse(text);
    return parsed;
  }catch(err){
    console.warn("Failed to fetch CSV:", err);
    throw err;
  }
}

// normalize numeric string: "1,0431" -> 1.0431 (handle comma decimal)
function parseNumber(x){
  if(x === null || x === undefined) return NaN;
  if(typeof x === "number") return x;
  const s = String(x).trim();
  if(s === "") return NaN;
  // remove thousands separators (if any), then replace comma decimal
  const replaced = s.replace(/\s/g,"").replace(/\.(?=\d{3,})/g,"").replace(/,/g,".");
  const n = parseFloat(replaced);
  return isNaN(n) ? NaN : n;
}

function safeTrim(s){ return (s||"").toString().trim(); }

// cosine similarity between two numeric vectors
function cosine(a,b){
  if(!a || !b || a.length !== b.length) return 0;
  let dot=0, na=0, nb=0;
  for(let i=0;i<a.length;i++){ dot += a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  if(na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}

// normalize array to [0,1] (min-max)
function normalizeArray(arr){
  const min = d3.min(arr), max = d3.max(arr);
  if(min === undefined || max === undefined || max === min) return arr.map(_=>0.5);
  return arr.map(v => (v - min) / (max - min));
}

/* ---------- Load / UI init ---------- */

async function tryAutoLoad(){
  loadNote.innerText = "Attempting to load CSV from GitHub...";
  try{
    const parsed = await fetchAndParseCsv(RAW_CSV);
    processRaw(parsed);
    loadNote.innerText = "✅ Data loaded from GitHub.";
  }catch(err){
    loadNote.innerText = "⚠️ Auto-load failed. Please Upload CSV manually.";
    console.error(err);
  }
}

uploadCsv.addEventListener("change", async (ev)=>{
  const file = ev.target.files && ev.target.files[0];
  if(!file) return;
  loadNote.innerText = `Reading ${file.name}...`;
  try{
    const text = await file.text();
    // detect delimiter
    const delim = text.indexOf(";") > -1 && text.indexOf(",") > -1 && text.indexOf(";") < text.indexOf(",") ? ";" : (text.indexOf(";")>-1?";":",");
    const parsed = d3.dsvFormat(delim).parse(text);
    processRaw(parsed);
    loadNote.innerText = `✅ CSV uploaded (${file.name}) — ${allData.length} rows.`;
  }catch(err){
    loadNote.innerText = "❌ Failed to read uploaded file.";
    console.error(err);
  }
});

autoLoadBtn.addEventListener("click", tryAutoLoad);

/* category buttons */
catButtons.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    catButtons.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.dataset.cat;
    selectedProductName = ""; // reset product selection when category changes
    updateUI();
  });
});

/* show similar */
showSimilarBtn.addEventListener("click", ()=>{
  const prod = productSelect.node().value;
  if(!prod){ similarNote.innerText = "Select a product first."; return; }
  selectedProductName = prod;
  showSimilarProducts();
});

/* ---------- Data processing ---------- */

function processRaw(parsedRows){
  // Normalize and coerce fields to consistent names we expect
  // Accept columns: User ID, Product ID, Product Name, Brand, Category, Price, Rating/5 (or Rating), Color, Size
  const rows = parsedRows.map(r=>{
    // Because CSV column names might include BOM or stray whitespace, find keys robustly:
    const keys = Object.keys(r);
    // helper to find column by a few possible names
    const find = (names)=> {
      for(const n of names){
        const k = keys.find(k2 => k2 && k2.toLowerCase().trim() === n.toLowerCase().trim());
        if(k) return r[k];
      }
      return undefined;
    };

    const userId = safeTrim(find(["User ID","CustomerID","Customer Id","Customer ID","user_id","user id"]) || find(["user","userid"]));
    const productId = safeTrim(find(["Product ID","StockCode","ProductID","product_id","product id"]) || find(["Product","Item ID"]));
    const prodName = safeTrim(find(["Product Name","Description","name","product_name"]));
    const brand = safeTrim(find(["Brand","brand"]));
    const category = safeTrim(find(["Category","category"])) || "Unknown";
    const priceRaw = find(["Price","UnitPrice","price"]) || "";
    const ratingRaw = find(["Rating/5","Rating","rating","rating/5"]) || "";
    const color = safeTrim(find(["Color","colour","Colour"]) || "");
    const size = safeTrim(find(["Size","size"]) || "");

    const price = parseNumber(priceRaw);
    const rating = parseNumber(ratingRaw);

    return {
      "User ID": userId || "unknown",
      "Product ID": productId || "unknown",
      "Product Name": prodName || "(no name)",
      "Brand": brand || "(no brand)",
      "Category": category || "Unknown",
      "Price": Number.isFinite(price) ? price : 0,
      "Rating": Number.isFinite(rating) ? rating : 0,
      "Color": color || "N/A",
      "Size": size || "N/A"
    };
  });

  // Filter out rows without Product ID or Name (defensive)
  allData = rows.filter(r => r["Product ID"] && r["Product Name"]);
  updateUI();
}

/* ---------- UI rendering ---------- */

function updateUI(){
  if(!allData || allData.length === 0){
    loadNote.innerText = "No data available.";
    return;
  }
  // Apply category filter
  const filtered = (currentCategory === "All") ? allData : allData.filter(d=>d.Category === currentCategory);
  // populate UI pieces
  renderTopRecommendations(filtered);
  populateProductSelect(filtered);
  renderEDA(filtered);
  renderTopTables(filtered);
  // if a product is selected, update history and similar container as well
  if(selectedProductName) {
    showSimilarProducts();
  } else {
    clearHistory();
    clearSimilar();
  }
  loadNote.innerText = `Data ready — ${allData.length} rows total • ${filtered.length} in "${currentCategory}".`;
}

/* --- Top Recommendations (simple: rating + price heuristics) --- */
function renderTopRecommendations(data){
  recommendationContainer.html("");
  if(!data || data.length===0) {
    recommendationContainer.append("div").attr("class","note small").text("No products in this category.");
    return;
  }
  // Choose top by rating but prefer lower price for "value"
  const top = [...data].sort((a,b) => {
    // primary: rating desc, secondary: price asc
    if(b.Rating !== a.Rating) return b.Rating - a.Rating;
    return a.Price - b.Price;
  }).slice(0,8);

  const cards = recommendationContainer.selectAll(".card").data(top, d=>d["Product ID"]);
  const enter = cards.enter().append("div").attr("class","card");
  enter.append("div").attr("class","badge").text("🔥 Hot");
  enter.append("h4").text(d=>`${d["Product ID"]} — ${d["Product Name"]}`);
  enter.append("p").text(d=>d.Brand);
  enter.append("p").html(d=>`<strong>${d.Rating.toFixed(2)}</strong>/5 • $${d.Price}`);
  // tooltip on hover
  enter.on("mouseover", (event,d)=>{
    tooltip.style("display","block").html(`Color: ${d.Color}<br/>Size: ${d.Size}<br/>Category: ${d.Category}`);
  }).on("mousemove", (event)=> tooltip.style("left", (event.pageX+12)+"px").style("top", (event.pageY+12)+"px"))
    .on("mouseout", ()=> tooltip.style("display","none"));
  cards.exit().remove();
}

/* --- Product dropdown for similarity/history --- */
function populateProductSelect(data){
  const uniqueNames = Array.from(new Set(data.map(d=>d["Product Name"]))).sort();
  productSelect.html("");
  productSelect.append("option").attr("value","").text("-- choose product name --");
  uniqueNames.forEach(n => productSelect.append("option").attr("value",n).text(n));
}

/* --- Similar Products (cosine on [rating, price]) --- */
function showSimilarProducts(){
  const selected = productSelect.node().value;
  if(!selected) { similarNote.innerText = "Select product name first."; return; }
  similarNote.innerText = `Showing products similar to: "${selected}" (within category "${currentCategory}")`;

  const filtered = (currentCategory === "All") ? allData : allData.filter(d=>d.Category === currentCategory);
  // pick a canonical example: median price/rating of that name
  const group = filtered.filter(d=>d["Product Name"] === selected);
  if(group.length === 0){ similarContainer.html(""); similarNote.innerText = "No items found for that product in selected category."; return; }
  // compute reference vector as mean of rating and price for that product name
  const refRating = d3.mean(group, d=>d.Rating);
  const refPrice = d3.mean(group, d=>d.Price);
  const refVec = [refRating, refPrice];

  // candidate set: same product name or same product type? user wanted same product type (name) different IDs -> but similarity across same category
  const candidates = filtered.filter(d=>d["Product Name"] !== selected); // exclude same name entries
  const sims = candidates.map(d => {
    const vec = [d.Rating, d.Price];
    return { ...d, similarity: cosine(vec, refVec) };
  }).sort((a,b)=>b.similarity - a.similarity).slice(0,8);

  // render cards
  similarContainer.html("");
  const selGroup = filtered.filter(d=>d["Product Name"]===selected).slice(0,6);
  // show a few direct variants (same name, different IDs) first
  if(selGroup.length){
    selGroup.slice(0,6).forEach(d=>{
      similarContainer.append("div").attr("class","card")
        .html(`<h4>${d["Product ID"]} — ${d["Product Name"]}</h4><p>${d.Brand}</p><p>${d.Rating.toFixed(2)}/5 • $${d.Price}</p>`)
        .on("mouseover",(e,dd)=>tooltip.style("display","block").html(`Color: ${dd.Color}<br/>Size: ${dd.Size}`))
        .on("mousemove",(e)=>tooltip.style("left",(e.pageX+12)+"px").style("top",(e.pageY+12)+"px"))
        .on("mouseout",()=>tooltip.style("display","none"));
    });
  }
  // then similar items
  sims.forEach(d=>{
    similarContainer.append("div").attr("class","card")
      .html(`<h4>${d["Product ID"]} — ${d["Product Name"]}</h4><p>${d.Brand}</p><p>sim ${d.similarity.toFixed(2)} • ${d.Rating.toFixed(2)}/5</p>`)
      .on("mouseover",(e,dd)=>tooltip.style("display","block").html(`Color: ${dd.Color}<br/>Size: ${dd.Size}<br/>Price: $${dd.Price}`))
      .on("mousemove",(e)=>tooltip.style("left",(e.pageX+12)+"px").style("top",(e.pageY+12)+"px"))
      .on("mouseout",()=>tooltip.style("display","none"));
  });

  // update purchase history for selected product name
  renderHistory(selected, filtered);
  // update top tables scoped to category & product name context
  renderTopTables(filtered, selected);
}

/* --- Purchase history by product name --- */
function renderHistory(productName, data){
  const rows = data.filter(d=>d["Product Name"] === productName);
  historyTableBody.html("");
  if(rows.length === 0){
    historyTableBody.append("tr").append("td").attr("colspan",5).text("No purchase history for this product in selected category.");
    return;
  }
  rows.forEach(row=>{
    historyTableBody.append("tr")
      .html(`<td>${row["Product ID"]}</td><td>${row["User ID"]}</td><td>${row.Brand}</td><td>${row.Rating.toFixed(2)}</td><td>$${row.Price}</td>`);
  });
}

/* --- Top tables (Rating & Score). If productName provided, score calculation limited to same product group & category context as requested. --- */
function renderTopTables(data, productName){
  // use the category-scoped data by default; if productName provided, compute relative to that subset
  const scopeData = data.slice(); // copy

  // compute normalization domains
  const ratings = scopeData.map(d=>d.Rating);
  const prices = scopeData.map(d=>d.Price);
  const normRatings = normalizeArray(ratings);
  const normPrices = normalizeArray(prices);

  // attach normalized values
  scopeData.forEach((d,i)=>{
    d._normRating = isFinite(normRatings[i]) ? normRatings[i] : 0;
    d._normPrice = isFinite(normPrices[i]) ? normPrices[i] : 0;
    d._diversity = Math.random()*1.0; // small random weight for diversity
    d._score = 0.5 * d._normRating + 0.3 * d._normPrice + 0.2 * d._diversity;
  });

  // Top by rating (top 10 overall in this category)
  const topByRating = [...scopeData].sort((a,b)=>b.Rating - a.Rating).slice(0,10);
  topRatingBody.html("");
  topByRating.forEach((d,i)=>{
    topRatingBody.append("tr").html(`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d.Rating.toFixed(2)}</td><td>${d.Color}</td><td>${d.Size}</td>`);
  });

  // Top by score, if a productName is provided we can prefer items related to it:
  let scoreCandidates = [...scopeData];
  if(productName){
    // rank those with same product name higher or include only same product family first — but requirement: "category + product selected to influence top10"
    // We'll boost same-name items slightly
    scoreCandidates.forEach(d=>{ if(d["Product Name"]===productName) d._score += 0.08; });
  }
  const topByScore = scoreCandidates.sort((a,b)=>b._score - a._score).slice(0,10);
  topScoreBody.html("");
  topByScore.forEach((d,i)=>{
    topScoreBody.append("tr").html(`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d.Rating.toFixed(2)}</td><td>$${d.Price}</td><td>${d.Color}</td><td>${d.Size}</td><td>${d._score.toFixed(3)}</td>`);
  });
}

/* --- EDA charts (D3 simple hist + scatter). Each chart clears and redraws */
function renderEDA(data){
  edaNote.innerText = `EDA updated for category: "${currentCategory}" — ${data.length} items. Hover bars/points for details.`;

  // remove old svgs
  d3.select("#ratingChart").selectAll("*").remove();
  d3.select("#priceChart").selectAll("*").remove();
  d3.select("#scatterChart").selectAll("*").remove();

  const safeData = data.filter(d=>isFinite(d.Rating) && isFinite(d.Price));

  // Rating histogram
  (function drawRating(){
    const w=360,h=220, pad=30;
    const svg = d3.select("#ratingChart").append("svg").attr("width",w).attr("height",h);
    const x = d3.scaleLinear().domain([0,5]).range([pad, w-pad]);
    const bins = d3.bin().domain(x.domain()).thresholds(10)(safeData.map(d=>d.Rating));
    const y = d3.scaleLinear().domain([0, d3.max(bins, b=>b.length) || 1]).range([h-pad, pad]);
    svg.selectAll("rect").data(bins).enter().append("rect")
      .attr("x",d=>x(d.x0)+1).attr("y",d=>y(d.length)).attr("width",d=>Math.max(0,x(d.x1)-x(d.x0)-2))
      .attr("height",d=>h-pad - y(d.length)).attr("fill","#ffb3d6")
      .on("mouseover",(e,d)=>tooltip.style("display","block").html(`${d.length} products<br/>${d.x0.toFixed(2)}–${d.x1.toFixed(2)} rating`))
      .on("mousemove",(e)=>tooltip.style("left",(e.pageX+12)+"px").style("top",(e.pageY+12)+"px"))
      .on("mouseout",()=>tooltip.style("display","none"));
    svg.append("g").append("text").attr("x",w/2).attr("y",18).attr("text-anchor","middle").text("Rating distribution (0–5)");
  })();

  // Price histogram
  (function drawPrice(){
    const w=360,h=220, pad=30;
    const svg = d3.select("#priceChart").append("svg").attr("width",w).attr("height",h);
    const extent = d3.extent(safeData, d=>d.Price);
    const x = d3.scaleLinear().domain(extent).nice().range([pad, w-pad]);
    const bins = d3.bin().domain(x.domain()).thresholds(12)(safeData.map(d=>d.Price));
    const y = d3.scaleLinear().domain([0, d3.max(bins, b=>b.length) || 1]).range([h-pad, pad]);
    svg.selectAll("rect").data(bins).enter().append("rect")
      .attr("x",d=>x(d.x0)+1).attr("y",d=>y(d.length)).attr("width",d=>Math.max(0,x(d.x1)-x(d.x0)-2))
      .attr("height",d=>h-pad - y(d.length)).attr("fill","#ff86bf")
      .on("mouseover",(e,d)=>tooltip.style("display","block").html(`${d.length} products<br/>$${d.x0.toFixed(2)}–$${d.x1.toFixed(2)}`))
      .on("mousemove",(e)=>tooltip.style("left",(e.pageX+12)+"px").style("top",(e.pageY+12)+"px"))
      .on("mouseout",()=>tooltip.style("display","none"));
    svg.append("g").append("text").attr("x",w/2).attr("y",18).attr("text-anchor","middle").text("Price distribution ($)");
  })();

  // Scatter Price vs Rating
  (function drawScatter(){
    const w=360,h=220,pad=36;
    const svg = d3.select("#scatterChart").append("svg").attr("width",w).attr("height",h);
    const x = d3.scaleLinear().domain(d3.extent(safeData, d=>d.Price)).nice().range([pad, w-pad]);
    const y = d3.scaleLinear().domain([0,5]).range([h-pad, pad]);
    svg.selectAll("circle").data(safeData).enter().append("circle").attr("cx",d=>x(d.Price)).attr("cy",d=>y(d.Rating)).attr("r",4).attr("fill","#e91e63").attr("opacity",0.9)
      .on("mouseover",(e,d)=>tooltip.style("display","block").html(`ID:${d["Product ID"]}<br/>${d["Product Name"]}<br/>$${d.Price} • ${d.Rating.toFixed(2)}★`))
      .on("mousemove",(e)=>tooltip.style("left",(e.pageX+12)+"px").style("top",(e.pageY+12)+"px"))
      .on("mouseout",()=>tooltip.style("display","none"));
    svg.append("g").append("text").attr("x",w/2).attr("y",18).attr("text-anchor","middle").text("Price vs Rating");
  })();

}

/* ---------- Utility to clear similar/history when none selected ---------- */
function clearHistory(){
  historyTableBody.html("");
}
function clearSimilar(){
  similarContainer.html("");
  similarNote.innerText = "";
}

/* ---------- init: attempt auto-load on start (but allow manual upload) ---------- */
tryAutoLoad();

/* Optional: expose some functions for debugging in console */
window.SmartRec = {
  reload: tryAutoLoad,
  getData: ()=>allData
};
