// ====================
// 🔧 Configuration
// ====================
const AUTOLOAD_URL = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/dthien_midexam/fashion_recommender.csv";

let allData = [];
let filteredData = [];
let currentCategory = "All";
let selectedProductName = "";

// ====================
// 📥 Load CSV Data
// ====================
d3.csv(AUTOLOAD_URL, d3.autoType).then(data => {
  allData = data.map(d => ({
    ...d,
    Category: d.Category ? d.Category.trim().replace(/[\u2019']/g,"'") : "",
    Brand: d.Brand ? d.Brand.trim() : "",
    ProductName: d['Product Name'] ? d['Product Name'].trim() : "",
    Size: d.Size ? d.Size.trim() : "",
    Color: d.Color ? d.Color.trim() : "",
    Rating: +String(d['Rating/5']).replace(',', '.'),
    Price: +d.Price
  }));
  filteredData = allData;
  initCategoryButtons();
  updateAllDisplays();
});

// ====================
// 🟢 Category Buttons
// ====================
function initCategoryButtons() {
  d3.selectAll('.category-btn').on('click', function() {
    currentCategory = d3.select(this).attr('data-category');
    selectedProductName = "";
    updateAllDisplays();
  });
}

// ====================
// 🔄 Update all displays
// ====================
function updateAllDisplays() {
  // Filter by category
  filteredData = (currentCategory === "All") ? allData : allData.filter(d => d.Category === currentCategory);

  updateTopRecommendations();
  updateEDACharts();
  updateProductSelect();
  updateSimilarProducts();
  updatePurchaseHistory();
  updateTop10Tables();
}

// ====================
// 2️⃣ Top Recommendations
// ====================
function updateTopRecommendations() {
  const container = d3.select('#top-recommendations');
  container.html('');
  const sorted = filteredData.sort((a,b) => (b.Rating + b.Price/10) - (a.Rating + a.Price/10));
  const top = sorted.slice(0,5);
  top.forEach(d => {
    const card = container.append('div').attr('class','card');
    card.html(`<div class="badge">🔥</div><b>${d['Product ID']} - ${d.ProductName}</b><br>${d.Brand}<br>Rating: ${d.Rating}<br>Price: $${d.Price}`);
    card.on('mouseover', function(event){
      showTooltip(event, `Color: ${d.Color}<br>Size: ${d.Size}`);
    }).on('mouseout', hideTooltip);
  });
}

// ====================
// 3️⃣ EDA Charts
// ====================
function updateEDACharts() {
  d3.select('#rating-dist').html('');
  d3.select('#price-dist').html('');
  d3.select('#price-vs-rating').html('');
  d3.select('#avg-rating-brand').html('');

  // Rating Distribution
  const ratings = filteredData.map(d=>d.Rating);
  const svg1 = d3.select('#rating-dist').append('svg').attr('width',400).attr('height',250);
  const x1 = d3.scaleLinear().domain([0,5]).range([40,380]);
  const histogram = d3.bin().domain(x1.domain()).thresholds(10)(ratings);
  const y1 = d3.scaleLinear().domain([0,d3.max(histogram,d=>d.length)]).range([200,20]);
  svg1.selectAll('rect')
      .data(histogram)
      .enter()
      .append('rect')
      .attr('x',d=>x1(d.x0))
      .attr('y',d=>y1(d.length))
      .attr('width',d=>x1(d.x1)-x1(d.x0)-1)
      .attr('height',d=>200-y1(d.length))
      .attr('fill','#f48fb1')
      .on('mouseover', function(event,d){ showTooltip(event, `Count: ${d.length}`); })
      .on('mouseout', hideTooltip);
  svg1.append('g').attr('transform','translate(0,200)').call(d3.axisBottom(x1));
  svg1.append('g').attr('transform','translate(40,0)').call(d3.axisLeft(y1));
  svg1.append('text').attr('x',200).attr('y',15).attr('text-anchor','middle').text('Rating Distribution');

  // Price Distribution
  const prices = filteredData.map(d=>d.Price);
  const svg2 = d3.select('#price-dist').append('svg').attr('width',400).attr('height',250);
  const x2 = d3.scaleLinear().domain([0,d3.max(prices)]).range([40,380]);
  const histogram2 = d3.bin().domain(x2.domain()).thresholds(10)(prices);
  const y2 = d3.scaleLinear().domain([0,d3.max(histogram2,d=>d.length)]).range([200,20]);
  svg2.selectAll('rect')
      .data(histogram2)
      .enter()
      .append('rect')
      .attr('x',d=>x2(d.x0))
      .attr('y',d=>y2(d.length))
      .attr('width',d=>x2(d.x1)-x2(d.x0)-1)
      .attr('height',d=>200-y2(d.length))
      .attr('fill','#ec407a')
      .on('mouseover', function(event,d){ showTooltip(event, `Count: ${d.length}`); })
      .on('mouseout', hideTooltip);
  svg2.append('g').attr('transform','translate(0,200)').call(d3.axisBottom(x2));
  svg2.append('g').attr('transform','translate(40,0)').call(d3.axisLeft(y2));
  svg2.append('text').attr('x',200).attr('y',15).attr('text-anchor','middle').text('Price Distribution');

  // Price vs Rating
  const svg3 = d3.select('#price-vs-rating').append('svg').attr('width',400).attr('height',250);
  const x3 = d3.scaleLinear().domain([0,d3.max(prices)]).range([40,380]);
  const y3 = d3.scaleLinear().domain([0,5]).range([200,20]);
  svg3.selectAll('circle')
      .data(filteredData)
      .enter()
      .append('circle')
      .attr('cx',d=>x3(d.Price))
      .attr('cy',d=>y3(d.Rating))
      .attr('r',5)
      .attr('fill','#d81b60')
      .on('mouseover', function(event,d){ showTooltip(event, `Rating: ${d.Rating}<br>Price: ${d.Price}`); })
      .on('mouseout', hideTooltip);
  svg3.append('g').attr('transform','translate(0,200)').call(d3.axisBottom(x3));
  svg3.append('g').attr('transform','translate(40,0)').call(d3.axisLeft(y3));
  svg3.append('text').attr('x',200).attr('y',15).attr('text-anchor','middle').text('Price vs Rating');

  // Average Rating per Brand
  const brandMap = d3.rollup(filteredData, v=>ss.mean(v.map(d=>d.Rating)), d=>d.Brand);
  const svg4 = d3.select('#avg-rating-brand').append('svg').attr('width',400).attr('height',250);
  const x4 = d3.scaleBand().domain(Array.from(brandMap.keys())).range([40,380]).padding(0.2);
  const y4 = d3.scaleLinear().domain([0,5]).range([200,20]);
  svg4.selectAll('rect')
      .data(Array.from(brandMap))
      .enter()
      .append('rect')
      .attr('x',d=>x4(d[0]))
      .attr('y',d=>y4(d[1]))
      .attr('width',x4.bandwidth())
      .attr('height',d=>200-y4(d[1]))
      .attr('fill','#f06292')
      .on('mouseover', function(event,d){ showTooltip(event, `Avg Rating: ${d[1].toFixed(2)}`); })
      .on('mouseout', hideTooltip);
  svg4.append('g').attr('transform','translate(0,200)').call(d3.axisBottom(x4));
  svg4.append('g').attr('transform','translate(40,0)').call(d3.axisLeft(y4));
  svg4.append('text').attr('x',200).attr('y',15).attr('text-anchor','middle').text('Average Rating per Brand');
}

// ====================
// 4️⃣ Content-Based Similar Products
// ====================
function updateProductSelect() {
  const select = d3.select('#product-select');
  select.html('<option value="">-- choose product name --</option>');
  const names = Array.from(new Set(filteredData.map(d=>d.ProductName)));
  names.forEach(n=>{
    select.append('option').attr('value',n).text(n);
  });
  select.on('change', function() {
    selectedProductName = this.value;
    updateSimilarProducts();
    updatePurchaseHistory();
    updateTop10Tables();
  });
}

function updateSimilarProducts() {
  const container = d3.select('#similar-products');
  container.html('');
  if (!selectedProductName) return;

  const baseItems = filteredData.filter(d=>d.ProductName === selectedProductName);
  const otherItems = filteredData.filter(d=>d.ProductName === selectedProductName);

  otherItems.forEach(d => {
    const card = container.append('div').attr('class','card');
    card.html(`<b>${d['Product ID']} - ${d.ProductName}</b><br>${d.Brand}`);
    card.on('mouseover', function(event){
      showTooltip(event, `Rating: ${d.Rating}<br>Price: ${d.Price}<br>Color: ${d.Color}<br>Size: ${d.Size}`);
    }).on('mouseout', hideTooltip);
  });
}

// ====================
// 5️⃣ Purchase History
// ====================
function updatePurchaseHistory() {
  const container = d3.select('#purchase-history');
  container.html('');
  if (!selectedProductName) return;
  const items = filteredData.filter(d=>d.ProductName === selectedProductName);
  if (items.length === 0) return container.append('p').text('No purchase history for this product.');
  const table = container.append('table');
  table.append('thead').html('<tr><th>ProductID</th><th>UserID</th><th>Brand</th><th>Rating</th><th>Price</th></tr>');
  const tbody = table.append('tbody');
  items.forEach(d=>{
    tbody.append('tr').html(`<td>${d['Product ID']}</td><td>${d['User ID']}</td><td>${d.Brand}</td><td>${d.Rating}</td><td>${d.Price}</td>`);
  });
}

// ====================
// 6️⃣ Top-10 Tables
// ====================
function updateTop10Tables() {
  const ratingTableDiv = d3.select('#top10-rating');
  const scoreTableDiv = d3.select('#top10-score');
  ratingTableDiv.html('');
  scoreTableDiv.html('');
  if (!selectedProductName) return;

  const items = filteredData.filter(d=>d.ProductName === selectedProductName);

  // Top 10 by Rating
  const topRating = items.sort((a,b)=>b.Rating - a.Rating).slice(0,10);
  const table1 = ratingTableDiv.append('table');
  table1.append('thead').html('<tr><th>Rank</th><th>ProductID</th><th>Name</th><th>Brand</th><th>Rating</th><th>Color</th><th>Size</th></tr>');
  const tbody1 = table1.append('tbody');
  topRating.forEach((d,i)=>{
    tbody1.append('tr').html(`<td>${i+1}</td><td>${d['Product ID']}</td><td>${d.ProductName}</td><td>${d.Brand}</td><td>${d.Rating}</td><td>${d.Color}</td><td>${d.Size}</td>`);
  });

  // Top 10 by Score
  const ratingMax = d3.max(items, d=>d.Rating);
  const priceMax = d3.max(items, d=>d.Price);
  const topScore = items.map(d=>{
    const score = 0.5*(d.Rating/ratingMax) + 0.3*(d.Price/priceMax) + 0.2*Math.random();
    return {...d, Score: score};
  }).sort((a,b)=>b.Score - a.Score).slice(0,10);
  const table2 = scoreTableDiv.append('table');
  table2.append('thead').html('<tr><th>Rank</th><th>ProductID</th><th>Name</th><th>Brand</th><th>Rating</th><th>Price</th><th>Color</th><th>Size</th><th>Score</th></tr>');
  const tbody2 = table2.append('tbody');
  topScore.forEach((d,i)=>{
    tbody2.append('tr').html(`<td>${i+1}</td><td>${d['Product ID']}</td><td>${d.ProductName}</td><td>${d.Brand}</td><td>${d.Rating}</td><td>${d.Price}</td><td>${d.Color}</td><td>${d.Size}</td><td>${d.Score.toFixed(3)}</td>`);
  });
}

// ====================
// 🔹 Tooltip
// ====================
const tooltip = d3.select('body').append('div').attr('class','tooltip');
function showTooltip(event, content){
  tooltip.html(content).style('opacity',1)
         .style('left',(event.pageX+10)+'px')
         .style('top',(event.pageY+10)+'px');
}
function hideTooltip(){
  tooltip.style('opacity',0);
}
