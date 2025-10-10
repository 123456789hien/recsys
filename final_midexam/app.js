// === CONFIG ===
const CSV_URL = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/final_midexam/fashion_recommender.csv";

let allData = [];
let filteredData = [];
let currentCategory = "All";
let currentProduct = null;

// === LOAD DATA ===
d3.csv(CSV_URL, d3.autoType).then(data => {
  // Clean & parse
  allData = data.map(d => ({
    UserID: d['User ID'],
    ProductID: d['Product ID'],
    ProductName: d['Product Name'],
    Brand: d.Brand,
    Category: d.Category,
    Price: +d.Price,
    Rating: +String(d['Rating/5']).replace(',', '.'),
    Color: d.Color,
    Size: d.Size
  })).filter(d => !isNaN(d.Rating) && !isNaN(d.Price));

  init();
});

// === INIT ===
function init() {
  setupCategoryButtons();
  populateProductSelect();
  updateViews();
}

// === CATEGORY BUTTONS ===
function setupCategoryButtons() {
  const btns = document.querySelectorAll(".category-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.category;
      currentProduct = null;
      populateProductSelect();
      updateViews();
    });
  });
}

// === PRODUCT SELECT ===
function populateProductSelect() {
  const select = document.getElementById("product-select");
  select.innerHTML = "";
  const products = [...new Set(allData
    .filter(d => currentCategory === "All" || d.Category === currentCategory)
    .map(d => d.ProductName))];
  products.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
}

// === UPDATE ALL VIEWS ===
function updateViews() {
  filteredData = allData.filter(d => currentCategory === "All" || d.Category === currentCategory);
  updateTopRecommendations();
  updateEDA();
  updateSimilarProducts();
  updatePurchaseHistory();
  updateTop10Tables();
}

// === TOP RECOMMENDATIONS ===
function updateTopRecommendations() {
  const container = document.getElementById("top-cards");
  container.innerHTML = "";
  const sorted = [...filteredData].sort((a,b)=>b.Rating - a.Rating).slice(0,5);
  sorted.forEach(d => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="hot-badge">🔥 Hot</div>
      <strong>${d.ProductID} - ${d.ProductName}</strong><br>
      Brand: ${d.Brand}<br>
      Rating: ${d.Rating.toFixed(2)}<br>
      Price: $${d.Price}<br>
      Color: ${d.Color}, Size: ${d.Size}
    `;
    container.appendChild(card);
  });
}

// === EDA CHARTS ===
function updateEDA() {
  d3.select("#rating-histogram").selectAll("*").remove();
  d3.select("#price-histogram").selectAll("*").remove();
  d3.select("#price-vs-rating").selectAll("*").remove();
  d3.select("#avg-rating-brand").selectAll("*").remove();

  const ratings = filteredData.map(d=>d.Rating);
  const prices = filteredData.map(d=>d.Price);

  // 1. Rating histogram
  const ratingSvg = d3.select("#rating-histogram").append("svg").attr("width",400).attr("height",200);
  const xScale = d3.scaleLinear().domain([0, d3.max(ratings)]).range([0, 350]);
  const histogram = d3.bin().domain(xScale.domain()).thresholds(10)(ratings);
  const yScale = d3.scaleLinear().domain([0,d3.max(histogram, d=>d.length)]).range([150,0]);
  ratingSvg.selectAll("rect")
    .data(histogram)
    .join("rect")
    .attr("x", d=>xScale(d.x0))
    .attr("y", d=>yScale(d.length))
    .attr("width", d=>xScale(d.x1)-xScale(d.x0)-1)
    .attr("height", d=>150-yScale(d.length))
    .attr("fill","#ff66a3")
    .append("title")
    .text(d=>`Count: ${d.length}`);
  ratingSvg.append("text").text("Rating Distribution").attr("x",150).attr("y",190);

  // 2. Price histogram
  const priceSvg = d3.select("#price-histogram").append("svg").attr("width",400).attr("height",200);
  const xP = d3.scaleLinear().domain([0, d3.max(prices)]).range([0,350]);
  const histPrice = d3.bin().domain(xP.domain()).thresholds(10)(prices);
  const yP = d3.scaleLinear().domain([0,d3.max(histPrice, d=>d.length)]).range([150,0]);
  priceSvg.selectAll("rect")
    .data(histPrice)
    .join("rect")
    .attr("x", d=>xP(d.x0))
    .attr("y", d=>yP(d.length))
    .attr("width", d=>xP(d.x1)-xP(d.x0)-1)
    .attr("height", d=>150-yP(d.length))
    .attr("fill","#ff99c8")
    .append("title")
    .text(d=>`Count: ${d.length}`);
  priceSvg.append("text").text("Price Distribution").attr("x",150).attr("y",190);

  // 3. Price vs Rating scatter
  const scatterSvg = d3.select("#price-vs-rating").append("svg").attr("width",400).attr("height",200);
  const xS = d3.scaleLinear().domain([0,d3.max(prices)]).range([30,380]);
  const yS = d3.scaleLinear().domain([0,d3.max(ratings)]).range([150,0]);
  scatterSvg.selectAll("circle")
    .data(filteredData)
    .join("circle")
    .attr("cx", d=>xS(d.Price))
    .attr("cy", d=>yS(d.Rating))
    .attr("r",5)
    .attr("fill","#d63384")
    .append("title")
    .text(d=>`Price: ${d.Price}, Rating: ${d.Rating}`);
  scatterSvg.append("text").text("Price vs Rating").attr("x",120).attr("y",190);

  // 4. Average Rating per Brand
  const brands = [...new Set(filteredData.map(d=>d.Brand))];
  const avgRatings = brands.map(b=>{
    const items = filteredData.filter(d=>d.Brand===b);
    return {Brand:b, AvgRating:d3.mean(items,d=>d.Rating)};
  });
  const brandSvg = d3.select("#avg-rating-brand").append("svg").attr("width",400).attr("height",200);
  const xB = d3.scaleBand().domain(brands).range([0,350]).padding(0.2);
  const yB = d3.scaleLinear().domain([0,5]).range([150,0]);
  brandSvg.selectAll("rect")
    .data(avgRatings)
    .join("rect")
    .attr("x", d=>xB(d.Brand))
    .attr("y", d=>yB(d.AvgRating))
    .attr("width", xB.bandwidth())
    .attr("height", d=>150-yB(d.AvgRating))
    .attr("fill","#ff66a3")
    .append("title")
    .text(d=>`Brand: ${d.Brand}\nAvg Rating: ${d.AvgRating.toFixed(2)}`);
  brandSvg.append("text").text("Average Rating per Brand").attr("x",80).attr("y",190);
}

// === SIMILAR PRODUCTS ===
function updateSimilarProducts() {
  currentProduct = document.getElementById("product-select").value;
  const container = document.getElementById("similar-cards");
  container.innerHTML = "";

  if(!currentProduct) return;

  const subset = filteredData.filter(d=>d.ProductName===currentProduct);
  const products = subset.map(d=>({...d}));

  // Cosine similarity
  function cosineSim(a,b){
    return (a.Rating*b.Rating + a.Price*b.Price)/(Math.sqrt(a.Rating**2+a.Price**2)*Math.sqrt(b.Rating**2+b.Price**2));
  }

  const target = products[0];
  const others = filteredData.filter(d=>d.ProductName===currentProduct && d.ProductID!==target.ProductID);
  const sims = others.map(d=>({...d, sim: cosineSim(target,d)})).sort((a,b)=>b.sim-a.sim).slice(0,5);

  sims.forEach(d=>{
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <strong>${d.ProductID} - ${d.ProductName}</strong><br>
      Brand: ${d.Brand}<br>
      Rating: ${d.Rating.toFixed(2)}<br>
      Price: $${d.Price}<br>
      Color: ${d.Color}, Size: ${d.Size}
    `;
    container.appendChild(card);
  });
}

// === PURCHASE HISTORY ===
function updatePurchaseHistory() {
  const table = document.querySelector("#purchase-history-table tbody");
  table.innerHTML = "";
  if(!currentProduct) return;
  const subset = filteredData.filter(d=>d.ProductName===currentProduct);
  subset.forEach(d=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${d.ProductID}</td><td>${d.UserID}</td><td>${d.Brand}</td><td>${d.Rating}</td><td>${d.Price}</td>`;
    table.appendChild(tr);
  });
}

// === TOP 10 TABLES ===
function updateTop10Tables() {
  const topRatingTable = document.querySelector("#top10-rating tbody");
  const topScoreTable = document.querySelector("#top10-score tbody");
  topRatingTable.innerHTML = "";
  topScoreTable.innerHTML = "";

  if(!currentProduct) return;
  const subset = filteredData.filter(d=>d.ProductName===currentProduct);

  // Top by rating
  subset.sort((a,b)=>b.Rating-a.Rating).slice(0,10).forEach((d,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${d.ProductID}</td><td>${d.ProductName}</td><td>${d.Brand}</td><td>${d.Rating.toFixed(2)}</td><td>${d.Color}</td><td>${d.Size}</td>`;
    topRatingTable.appendChild(tr);
  });

  // Top by score
  const maxR = d3.max(subset,d=>d.Rating);
  const maxP = d3.max(subset,d=>d.Price);
  subset.forEach(d=>{ 
    d.Score = 0.5*(d.Rating/maxR) + 0.3*(d.Price/maxP) + 0.2*Math.random();
  });
  subset.sort((a,b)=>b.Score-a.Score).slice(0,10).forEach((d,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${d.ProductID}</td><td>${d.ProductName}</td><td>${d.Brand}</td><td>${d.Rating.toFixed(2)}</td><td>${d.Price}</td><td>${d.Color}</td><td>${d.Size}</td><td>${d.Score.toFixed(2)}</td>`;
    topScoreTable.appendChild(tr);
  });
}
