const csvURL = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/hiendo_midexam/fashion_recommender.csv";

let allData = [];
let currentCategory = "All";
let selectedProduct = null;

// --- Load CSV ---
d3.text(csvURL).then(rawText => {
    let rows = rawText.trim().split("\n");
    let headers = rows[0].split(";").map(h => h.trim());
    allData = rows.slice(1).map(r => {
        const cols = r.split(";").map(c => c.trim());
        let obj = {};
        headers.forEach((h,i)=>{
            let key = h.trim();
            let val = cols[i];
            if(key==="Price" || key==="Rating/5") val = parseFloat(val.replace(",", "."));
            obj[key]=val;
        });
        return obj;
    });
    populateProductSelect();
    updateAll();
});

// --- Category buttons ---
document.querySelectorAll(".category-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        currentCategory = btn.dataset.category;
        selectedProduct = null;
        document.getElementById("product-select").value="";
        updateAll();
    });
});

// --- Populate product select ---
function populateProductSelect() {
    let select = document.getElementById("product-select");
    let products = Array.from(new Set(allData.map(d=>d["Product Name"]))).sort();
    select.innerHTML = `<option value="">--Select Product--</option>`;
    products.forEach(p=>{
        let option = document.createElement("option");
        option.value = p;
        option.textContent = p;
        select.appendChild(option);
    });
}

// --- Show Similar Products ---
document.getElementById("show-similar").addEventListener("click", () => {
    selectedProduct = document.getElementById("product-select").value;
    updateAll();
});

// --- Main Update Function ---
function updateAll(){
    let filtered = currentCategory==="All"? allData : allData.filter(d=>d.Category.trim()===currentCategory.trim());

    // 2️⃣ Top Recommendations (based on Rating+Price)
    let topRecs = filtered.slice().sort((a,b)=>b["Rating/5"] - a["Rating/5"]).slice(0,5);
    let topDiv = document.getElementById("top-cards");
    topDiv.innerHTML = "";
    topRecs.forEach(d=>{
        let card = document.createElement("div");
        card.className="card";
        card.innerHTML = `<div class="badge">🔥 Hot</div>
        <strong>${d["Product ID"]} - ${d["Product Name"]}</strong><br>
        Brand: ${d.Brand}<br>
        Rating: ${d["Rating/5"]}<br>
        Price: $${d.Price}<br>
        Color: ${d.Color}<br>
        Size: ${d.Size}`;
        topDiv.appendChild(card);
    });

    // 3️⃣ EDA Charts
    updateEDA(filtered);

    // 4️⃣ Content-Based Similar Products
    if(selectedProduct){
        let similarData = filtered.filter(d=>d["Product Name"].trim()===selectedProduct.trim());
        updateSimilar(similarData);
    }else{
        document.getElementById("similar-cards").innerHTML="";
        document.getElementById("purchase-table").querySelector("tbody").innerHTML="";
        document.getElementById("top10-rating").querySelector("tbody").innerHTML="";
        document.getElementById("top10-score").querySelector("tbody").innerHTML="";
    }
}

// --- EDA with tooltips ---
function updateEDA(data){
    // Rating Histogram
    d3.select("#rating-histogram").html("");
    let ratingValues = data.map(d=>d["Rating/5"]);
    let svgR = d3.select("#rating-histogram").append("svg").attr("width",400).attr("height",200);
    let xR = d3.scaleLinear().domain([0,d3.max(ratingValues)]).range([30,370]);
    let histR = d3.histogram().domain(xR.domain()).thresholds(10)(ratingValues);
    let yR = d3.scaleLinear().domain([0,d3.max(histR,d=>d.length)]).range([170,20]);
    svgR.selectAll("rect").data(histR).enter()
        .append("rect")
        .attr("x",d=>xR(d.x0))
        .attr("y",d=>yR(d.length))
        .attr("width",d=>xR(d.x1)-xR(d.x0)-2)
        .attr("height",d=>170-yR(d.length))
        .attr("fill","#ff66aa")
        .append("title")
        .text(d=>`Count: ${d.length}, Range: ${d.x0.toFixed(2)}-${d.x1.toFixed(2)}`);
    svgR.append("text").attr("x",200).attr("y",15).attr("text-anchor","middle").text("Rating Distribution");

    // Price Histogram
    d3.select("#price-histogram").html("");
    let priceValues = data.map(d=>d.Price);
    let svgP = d3.select("#price-histogram").append("svg").attr("width",400).attr("height",200);
    let xP = d3.scaleLinear().domain([0,d3.max(priceValues)]).range([30,370]);
    let histP = d3.histogram().domain(xP.domain()).thresholds(10)(priceValues);
    let yP = d3.scaleLinear().domain([0,d3.max(histP,d=>d.length)]).range([170,20]);
    svgP.selectAll("rect").data(histP).enter()
        .append("rect")
        .attr("x",d=>xP(d.x0))
        .attr("y",d=>yP(d.length))
        .attr("width",d=>xP(d.x1)-xP(d.x0)-2)
        .attr("height",d=>170-yP(d.length))
        .attr("fill","#ff99cc")
        .append("title")
        .text(d=>`Count: ${d.length}, Range: ${d.x0.toFixed(2)}-${d.x1.toFixed(2)}`);
    svgP.append("text").attr("x",200).attr("y",15).attr("text-anchor","middle").text("Price Distribution");

    // Price vs Rating Scatter
    d3.select("#price-vs-rating").html("");
    let svgS = d3.select("#price-vs-rating").append("svg").attr("width",400).attr("height",200);
    let xS = d3.scaleLinear().domain([0,d3.max(priceValues)]).range([40,370]);
    let yS = d3.scaleLinear().domain([0,d3.max(ratingValues)]).range([170,20]);
    svgS.selectAll("circle").data(data).enter()
        .append("circle")
        .attr("cx",d=>xS(d.Price))
        .attr("cy",d=>yS(d["Rating/5"]))
        .attr("r",5)
        .attr("fill","#ff3399")
        .append("title")
        .text(d=>`Price: ${d.Price}, Rating: ${d["Rating/5"]}, Product: ${d["Product Name"]}`);
    svgS.append("text").attr("x",200).attr("y",15).attr("text-anchor","middle").text("Price vs Rating Scatter");
}

// --- Similar Products (cosine similarity on normalized Price & Rating) ---
function updateSimilar(data){
    let norm = d=>{
        let rMax = d3.max(data.map(d=>d["Rating/5"]));
        let rMin = d3.min(data.map(d=>d["Rating/5"]));
        let pMax = d3.max(data.map(d=>d.Price));
        let pMin = d3.min(data.map(d=>d.Price));
        return {
            Rating: (d["Rating/5"]-rMin)/(rMax-rMin),
            Price: (d.Price-pMin)/(pMax-pMin)
        };
    };
    let vectors = data.map(d=>norm(d));
    let simScores = data.map((d,i)=>{
        let v1=[vectors[i].Rating,vectors[i].Price];
        return data.map((other,j)=>{
            if(i===j) return 0;
            let v2=[vectors[j].Rating,vectors[j].Price];
            let cosSim = (v1[0]*v2[0]+v1[1]*v2[1])/(Math.sqrt(v1[0]**2+v1[1]**2)*Math.sqrt(v2[0]**2+v2[1]**2));
            return {index:j, score: cosSim};
        }).sort((a,b)=>b.score-a.score).slice(0,5);
    });

    let similarDiv = document.getElementById("similar-cards");
    similarDiv.innerHTML="";
    if(selectedProduct){
        simScores[0].forEach(s=>{
            let d = data[s.index];
            let card = document.createElement("div");
            card.className="card";
            card.innerHTML = `<strong>${d["Product ID"]} - ${d["Product Name"]}</strong><br>
            Brand: ${d.Brand}<br>
            Rating: ${d["Rating/5"]}<br>
            Price: $${d.Price}<br>
            Color: ${d.Color}<br>
            Size: ${d.Size}`;
            similarDiv.appendChild(card);
        });
    }

    // --- Purchase History Table ---
    let purTable = document.getElementById("purchase-table").querySelector("tbody");
    let purData = allData.filter(d=>d["Product Name"]===selectedProduct && (currentCategory==="All"? true: d.Category===currentCategory));
    purTable.innerHTML="";
    purData.forEach(d=>{
        let row = purTable.insertRow();
        row.innerHTML=`<td>${d["Product ID"]}</td><td>${d["User ID"]}</td><td>${d.Brand}</td><td>${d["Rating/5"]}</td><td>${d.Price}</td>`;
    });

    // --- Top-10 Tables ---
    let top10Rating = purData.slice().sort((a,b)=>b["Rating/5"]-a["Rating/5"]).slice(0,10);
    let top10Score = purData.slice().map(d=>{
        return {...d, score: 0.5*d["Rating/5"] + 0.3*d.Price + 0.2*Math.random()};
    }).sort((a,b)=>b.score-a.score).slice(0,10);

    let tBodyR = document.getElementById("top10-rating").querySelector("tbody");
    tBodyR.innerHTML="";
    top10Rating.forEach((d,i)=>{
        let row=tBodyR.insertRow();
        row.innerHTML=`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d["Rating/5"]}</td><td>${d.Price}</td><td>${d.Color}</td><td>${d.Size}</td>`;
    });

    let tBodyS = document.getElementById("top10-score").querySelector("tbody");
    tBodyS.innerHTML="";
    top10Score.forEach((d,i)=>{
        let row=tBodyS.insertRow();
        row.innerHTML=`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d["Rating/5"]}</td><td>${d.Price}</td><td>${d.Color}</td><td>${d.Size}</td><td>${d.score.toFixed(2)}</td>`;
    });
}
