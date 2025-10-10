// ✅ Load CSV Data
const dataUrl = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/tkhimid_exam/fashion_recommender.csv";

let allData = [];
let currentCategory = "All";

d3.csv(dataUrl, d3.autoType).then(data => {
  allData = data.map(d => ({
    ...d,
    Price: +String(d.Price).replace(",", "."),
    Rating: +String(d["Rating/5"]).replace(",", "."),
    Category: d.Category.trim(),
    Size: d.Size || "N/A"
  }));
  updateUI();
});

// ✅ Category Buttons
document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    currentCategory = e.target.dataset.category;
    updateUI();
  });
});

// ✅ Main update function
function updateUI() {
  const filtered = currentCategory === "All" ? allData : allData.filter(d => d.Category === currentCategory);
  renderTopRecommendations(filtered);
  renderEDA(filtered);
  populateProductSelect(filtered);
  renderTopTables(filtered);
}

// ✅ 2️⃣ Top Recommendations
function renderTopRecommendations(data) {
  const sorted = [...data].sort((a,b)=>b.Rating - a.Rating).slice(0,5);
  const container = d3.select("#recommendation-container").html("");
  sorted.forEach((d,i)=>{
    container.append("div")
      .attr("class","card")
      .html(`<span class='badge'>🔥 Hot</span>
        <h4>${d["Product ID"]} - ${d["Product Name"]}</h4>
        <p>${d.Brand}</p>
        <p><b>${d.Rating.toFixed(2)}</b>/5 | $${d.Price}</p>`)
      .attr("title", `Color: ${d.Color}, Size: ${d.Size}`);
  });
}

// ✅ 3️⃣ EDA Charts (Dynamic per Category)
function renderEDA(data) {
  d3.select("#rating-chart").html("");
  d3.select("#price-chart").html("");
  d3.select("#scatter-chart").html("");

  // Rating distribution
  const svg1 = d3.select("#rating-chart").append("svg").attr("width",300).attr("height",200);
  const x1 = d3.scaleLinear().domain([0,5]).range([30,270]);
  const bins = d3.bin().domain(x1.domain()).thresholds(10)(data.map(d=>d.Rating));
  const y1 = d3.scaleLinear().domain([0,d3.max(bins,d=>d.length)]).range([180,20]);
  const bars = svg1.selectAll("rect").data(bins).enter().append("rect")
    .attr("x",d=>x1(d.x0)+2).attr("y",d=>y1(d.length))
    .attr("width",d=>x1(d.x1)-x1(d.x0)-4).attr("height",d=>180 - y1(d.length))
    .attr("fill","#f48fb1");
  svg1.append("text").attr("x",150).attr("y",15).attr("text-anchor","middle").text("Rating Distribution");

  // Price distribution
  const svg2 = d3.select("#price-chart").append("svg").attr("width",300).attr("height",200);
  const x2 = d3.scaleLinear().domain(d3.extent(data,d=>d.Price)).range([30,270]);
  const bins2 = d3.bin().domain(x2.domain()).thresholds(10)(data.map(d=>d.Price));
  const y2 = d3.scaleLinear().domain([0,d3.max(bins2,d=>d.length)]).range([180,20]);
  svg2.selectAll("rect").data(bins2).enter().append("rect")
    .attr("x",d=>x2(d.x0)+2).attr("y",d=>y2(d.length))
    .attr("width",d=>x2(d.x1)-x2(d.x0)-4).attr("height",d=>180 - y2(d.length))
    .attr("fill","#f06292");
  svg2.append("text").attr("x",150).attr("y",15).attr("text-anchor","middle").text("Price Distribution");

  // Scatter (Price vs Rating)
  const svg3 = d3.select("#scatter-chart").append("svg").attr("width",300).attr("height",200);
  const x3 = d3.scaleLinear().domain(d3.extent(data,d=>d.Price)).range([30,270]);
  const y3 = d3.scaleLinear().domain([0,5]).range([180,20]);
  svg3.selectAll("circle").data(data).enter().append("circle")
    .attr("cx",d=>x3(d.Price)).attr("cy",d=>y3(d.Rating))
    .attr("r",4).attr("fill","#ec407a")
    .append("title").text(d=>`Price: $${d.Price}, Rating: ${d.Rating}`);
  svg3.append("text").attr("x",150).attr("y",15).attr("text-anchor","middle").text("Price vs Rating");
}

// ✅ 4️⃣ Similar Products (Cosine Similarity)
document.getElementById("show-similar").addEventListener("click",()=>{
  const selected = document.getElementById("product-select").value;
  const filtered = currentCategory === "All" ? allData : allData.filter(d => d.Category === currentCategory);
  const target = filtered.find(d => d["Product Name"] === selected);
  if(!target) return;

  const simData = filtered.map(d => {
    const vec1 = [d.Rating, d.Price];
    const vec2 = [target.Rating, target.Price];
    const dot = vec1[0]*vec2[0] + vec1[1]*vec2[1];
    const norm1 = Math.sqrt(vec1[0]**2 + vec1[1]**2);
    const norm2 = Math.sqrt(vec2[0]**2 + vec2[1]**2);
    const sim = dot / (norm1 * norm2);
    return {...d, similarity: sim};
  }).filter(d => d["Product Name"] !== selected)
    .sort((a,b)=>b.similarity - a.similarity)
    .slice(0,5);

  const container = d3.select("#similar-container").html("");
  simData.forEach(d=>{
    container.append("div")
      .attr("class","card")
      .html(`<h4>${d["Product ID"]} - ${d["Product Name"]}</h4>
             <p>${d.Brand}</p>
             <p>Sim: ${d.similarity.toFixed(2)}</p>`)
      .attr("title",`Rating: ${d.Rating}, Price: ${d.Price}, Color: ${d.Color}, Size: ${d.Size}`);
  });
  renderHistory(selected, filtered);
  renderTopTables(filtered, selected);
});

// ✅ Populate Product Dropdown
function populateProductSelect(data){
  const select = d3.select("#product-select").html("");
  const names = [...new Set(data.map(d=>d["Product Name"]))];
  names.forEach(n=>select.append("option").text(n));
}

// ✅ 5️⃣ Purchase History
function renderHistory(productName, data){
  const tbody = d3.select("#history-table tbody").html("");
  data.filter(d=>d["Product Name"] === productName)
      .forEach(d=>{
        tbody.append("tr").html(`
          <td>${d["Product ID"]}</td><td>${d["User ID"]}</td>
          <td>${d.Brand}</td><td>${d.Rating}</td><td>${d.Price}</td>`);
      });
}

// ✅ 6️⃣ Top-10 Tables
function renderTopTables(data, selectedProduct){
  // Normalize
  const minR = d3.min(data,d=>d.Rating), maxR = d3.max(data,d=>d.Rating);
  const minP = d3.min(data,d=>d.Price), maxP = d3.max(data,d=>d.Price);
  const scored = data.map(d=>({
    ...d,
    Score: 0.5*((d.Rating-minR)/(maxR-minR)) + 0.3*((d.Price-minP)/(maxP-minP)) + 0.2*Math.random()
  }));

  // Top 10 Rating
  const topR = [...data].sort((a,b)=>b.Rating - a.Rating).slice(0,10);
  const topS = [...scored].sort((a,b)=>b.Score - a.Score).slice(0,10);

  const rBody = d3.select("#top-rating-table tbody").html("");
  topR.forEach((d,i)=>{
    rBody.append("tr").html(`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d.Rating.toFixed(2)}</td><td>${d.Color}</td><td>${d.Size}</td>`);
  });

  const sBody = d3.select("#top-score-table tbody").html("");
  topS.forEach((d,i)=>{
    sBody.append("tr").html(`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d.Rating.toFixed(2)}</td><td>${d.Price}</td><td>${d.Color}</td><td>${d.Size}</td><td>${d.Score.toFixed(3)}</td>`);
  });
}
