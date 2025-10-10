const DATA_URL = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/midexam_fn/fashion_recommender.csv";

let allData = [], filteredData = [], currentCategory = "All";

d3.text(DATA_URL).then(raw => {
    const rows = d3.csvParseRows(raw,";");
    const header = rows[0].map(h=>h.trim());
    allData = rows.slice(1).map(r=>{
        let obj = {};
        header.forEach((h,i)=>obj[h]=r[i].trim());
        obj["Price"]=parseFloat(obj["Price"]);
        obj["Rating/5"]=parseFloat(obj["Rating/5"].replace(",",".")); 
        return obj;
    });
    filteredData = allData.slice();
    initCategoryButtons();
    updateTopRecommendations();
    populateProductSelect();
    updateEDA();
    updateTop10Tables();
}).catch(err=>console.error("Failed to load CSV:", err));

function initCategoryButtons(){
    d3.selectAll(".category-btn").on("click", function(){
        currentCategory = this.dataset.category;
        filterByCategory();
    });
}

function filterByCategory(){
    filteredData = currentCategory==="All"? allData.slice() : allData.filter(d=>d["Category"]===currentCategory);
    updateTopRecommendations();
    populateProductSelect();
    updateEDA();
    updateTop10Tables();
    clearSimilarProducts();
    clearPurchaseHistory();
}

function updateTopRecommendations(){
    const container = d3.select("#top-recommendations");
    container.html("");
    const top = filteredData.sort((a,b)=> (b["Rating/5"]+b.Price/100)-(a["Rating/5"]+a.Price/100)).slice(0,5);
    top.forEach((item,i)=>{
        const card = container.append("div").attr("class","card")
            .html(`<strong>${item["Product ID"]} - ${item["Product Name"]}</strong><br>${item.Brand}`)
            .append("span").attr("class","badge-hot").text("🔥 Hot");
        card.append("title").text(`Rating: ${item["Rating/5"]}\nPrice: $${item.Price}\nColor: ${item.Color}\nSize: ${item.Size}`);
    });
}

function populateProductSelect(){
    const select = d3.select("#product-select");
    select.html("");
    const products = Array.from(new Set(filteredData.map(d=>d["Product Name"])));
    products.forEach(p=>{
        select.append("option").attr("value",p).text(p);
    });
}

d3.select("#show-similar").on("click",()=>{
    const productName = d3.select("#product-select").property("value");
    showSimilarProducts(productName);
    showPurchaseHistory(productName);
    updateTop10Tables(productName);
});

function showSimilarProducts(productName){
    const container = d3.select("#similar-products");
    container.html("");
    const subset = filteredData.filter(d=>d["Product Name"]===productName);
    const maxPrice = d3.max(subset,d=>d.Price);
    const maxRating = d3.max(subset,d=>d["Rating/5"]);
    const meanPrice = d3.mean(subset,d=>d.Price);
    subset.forEach(item=>{
        const score = ((item["Rating/5"]/maxRating)*0.6 + (item.Price/meanPrice)*0.4).toFixed(2);
        const card = container.append("div").attr("class","card")
            .html(`<strong>${item["Product ID"]} - ${item["Product Name"]}</strong><br>${item.Brand}`)
            .append("span").attr("class","badge-hot").text("🔥 Hot");
        card.append("title").text(`Rating: ${item["Rating/5"]}\nPrice: $${item.Price}\nColor: ${item.Color}\nSize: ${item.Size}\nScore: ${score}`);
    });
}

function showPurchaseHistory(productName){
    const table = d3.select("#purchase-history tbody");
    table.html("");
    filteredData.filter(d=>d["Product Name"]===productName)
        .forEach(d=>{
            const row = table.append("tr");
            row.append("td").text(d["Product ID"]);
            row.append("td").text(d["User ID"]);
            row.append("td").text(d.Brand);
            row.append("td").text(d["Rating/5"]);
            row.append("td").text(d.Price);
        });
}

function updateTop10Tables(selectedProduct){
    const subset = selectedProduct ? filteredData.filter(d=>d["Product Name"]===selectedProduct) : filteredData;
    // Top by Rating
    const topRating = subset.sort((a,b)=>b["Rating/5"]-a["Rating/5"]).slice(0,10);
    const tbodyR = d3.select("#top10-rating tbody"); tbodyR.html("");
    topRating.forEach((d,i)=>{
        const row = tbodyR.append("tr");
        row.append("td").text(i+1);
        row.append("td").text(d["Product ID"]);
        row.append("td").text(d["Product Name"]);
        row.append("td").text(d.Brand);
        row.append("td").text(d["Rating/5"]);
        row.append("td").text(d.Price);
        row.append("td").text(d.Color);
        row.append("td").text(d.Size);
    });
    // Top by Score
    const maxRating = d3.max(subset,d=>d["Rating/5"]);
    const maxPrice = d3.max(subset,d=>d.Price);
    const topScore = subset.map(d=>{
        const normRating = d["Rating/5"]/maxRating;
        const normPrice = d.Price/maxPrice;
        const randWeight = Math.random()*0.2;
        return {...d, Score:(0.5*normRating + 0.3*normPrice + 0.2*randWeight).toFixed(3)};
    }).sort((a,b)=>b.Score-a.Score).slice(0,10);
    const tbodyS = d3.select("#top10-score tbody"); tbodyS.html("");
    topScore.forEach((d,i)=>{
        const row = tbodyS.append("tr");
        row.append("td").text(i+1);
        row.append("td").text(d["Product ID"]);
        row.append("td").text(d["Product Name"]);
        row.append("td").text(d.Brand);
        row.append("td").text(d["Rating/5"]);
        row.append("td").text(d.Price);
        row.append("td").text(d.Color);
        row.append("td").text(d.Size);
        row.append("td").text(d.Score);
    });
}

// Clear helpers
function clearSimilarProducts(){ d3.select("#similar-products").html(""); }
function clearPurchaseHistory(){ d3.select("#purchase-history tbody").html(""); }

// ==========================
// EDA Charts
function updateEDA(){
    d3.selectAll("#rating-histogram, #price-histogram, #price-rating-scatter, #avg-rating-brand").html("");
    const margin = {top:20,right:20,bottom:30,left:40}, width=400, height=250;

    // Rating Histogram
    const svgR = d3.select("#rating-histogram").append("svg").attr("width",width).attr("height",height);
    const ratings = filteredData.map(d=>d["Rating/5"]);
    const xR = d3.scaleLinear().domain([0,5]).range([margin.left,width-margin.right]);
    const histR = d3.bin().domain(xR.domain()).thresholds(5)(ratings);
    const yR = d3.scaleLinear().domain([0,d3.max(histR,h=>h.length)]).range([height-margin.bottom,margin.top]);
    svgR.selectAll("rect").data(histR).enter().append("rect")
        .attr("x",d=>xR(d.x0)).attr("y",d=>yR(d.length))
        .attr("width",d=>xR(d.x1)-xR(d.x0)-2)
        .attr("height",d=>height-margin.bottom-yR(d.length))
        .attr("fill","#ff80bf")
        .append("title").text(d=>`Count: ${d.length}`);
    svgR.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(xR));
    svgR.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(yR));
    svgR.append("text").attr("x",width/2).attr("y",15).attr("text-anchor","middle").text("Rating Histogram");

    // Price Histogram
    const svgP = d3.select("#price-histogram").append("svg").attr("width",width).attr("height",height);
    const prices = filteredData.map(d=>d.Price);
    const xP = d3.scaleLinear().domain([0,d3.max(prices)]).range([margin.left,width-margin.right]);
    const histP = d3.bin().domain(xP.domain()).thresholds(10)(prices);
    const yP = d3.scaleLinear().domain([0,d3.max(histP,h=>h.length)]).range([height-margin.bottom,margin.top]);
    svgP.selectAll("rect").data(histP).enter().append("rect")
        .attr("x",d=>xP(d.x0)).attr("y",d=>yP(d.length))
        .attr("width",d=>xP(d.x1)-xP(d.x0)-2)
        .attr("height",d=>height-margin.bottom-yP(d.length))
        .attr("fill","#ffb3d9")
        .append("title").text(d=>`Count: ${d.length}`);
    svgP.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(xP));
    svgP.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(yP));
    svgP.append("text").attr("x",width/2).attr("y",15).attr("text-anchor","middle").text("Price Histogram");

    // Price vs Rating Scatter
    const svgS = d3.select("#price-rating-scatter").append("svg").attr("width",width).attr("height",height);
    const xS = d3.scaleLinear().domain([0,d3.max(prices)]).range([margin.left,width-margin.right]);
    const yS = d3.scaleLinear().domain([0,5]).range([height-margin.bottom,margin.top]);
    svgS.selectAll("circle").data(filteredData).enter().append("circle")
        .attr("cx",d=>xS(d.Price)).attr("cy",d=>yS(d["Rating/5"]))
        .attr("r",5).attr("fill","#ff4da6")
        .append("title").text(d=>`Price: $${d.Price}\nRating: ${d["Rating/5"]}\nColor: ${d.Color}\nSize: ${d.Size}`);
    svgS.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(xS));
    svgS.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(yS));
    svgS.append("text").attr("x",width/2).attr("y",15).attr("text-anchor","middle").text("Price vs Rating Scatter");

    // Avg Rating per Brand
    const brandMap = {};
    filteredData.forEach(d=>{brandMap[d.Brand]=brandMap[d.Brand]||[]; brandMap[d.Brand].push(d["Rating/5"])});
    const brandAvg = Object.entries(brandMap).map(([b,r])=>({Brand:b,AvgRating:d3.mean(r)}));
    const svgB = d3.select("#avg-rating-brand").append("svg").attr("width",width).attr("height",height);
    const xB = d3.scaleBand().domain(brandAvg.map(d=>d.Brand)).range([margin.left,width-margin.right]).padding(0.3);
    const yB = d3.scaleLinear().domain([0,5]).range([height-margin.bottom,margin.top]);
    svgB.selectAll("rect").data(brandAvg).enter().append("rect")
        .attr("x",d=>xB(d.Brand)).attr("y",d=>yB(d.AvgRating))
        .attr("width",xB.bandwidth()).attr("height",d=>height-margin.bottom-yB(d.AvgRating))
        .attr("fill","#ff3399")
        .append("title").text(d=>`Brand: ${d.Brand}\nAvg Rating: ${d.AvgRating.toFixed(2)}`);
    svgB.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(xB));
    svgB.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(yB));
    svgB.append("text").attr("x",width/2).attr("y",15).attr("text-anchor","middle").text("Average Rating per Brand");
}
