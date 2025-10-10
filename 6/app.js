// === STEP 1: Load CSV ===
// Run on local server (Live Server or python -m http.server)
d3.csv("fashion_recommender.csv").then(data => {
    console.log("CSV Loaded ✅", data);

    // === STEP 2: Data Preprocessing ===
    data.forEach(d => {
        d.Price = +d.Price;
        d.Rating = +d["Rating/5"];
    });

    // === STEP 3: EDA Summary ===
    const totalProducts = data.length;
    const prices = data.map(d => d.Price);
    const ratings = data.map(d => d.Rating);
    const avgPrice = d3.mean(prices).toFixed(2);
    const maxPrice = d3.max(prices);
    const minPrice = d3.min(prices);
    const avgRating = d3.mean(ratings).toFixed(2);

    d3.select("#eda-summary").html(`
        <p>Total Products: <strong>${totalProducts}</strong></p>
        <p>Average Price: <strong>$${avgPrice}</strong> (Max: $${maxPrice}, Min: $${minPrice})</p>
        <p>Average Rating: <strong>${avgRating}/5</strong></p>
        <p>Insights: Top priced products target premium customers, lower priced for budget-sensitive segments.</p>
    `);

    // === STEP 4: EDA Charts ===
    const width = 400, height = 300, margin = {top:20,right:20,bottom:30,left:40};

    // Price histogram
    const priceSvg = d3.select("#price-chart");
    const xPrice = d3.scaleLinear().domain([0, d3.max(prices)]).range([margin.left, width-margin.right]);
    const binsPrice = d3.bin().domain(xPrice.domain()).thresholds(20)(prices);
    const yPrice = d3.scaleLinear().domain([0, d3.max(binsPrice, d=>d.length)]).range([height-margin.bottom, margin.top]);

    priceSvg.selectAll("rect").data(binsPrice).enter()
        .append("rect")
        .attr("x", d => xPrice(d.x0)+1)
        .attr("y", d => yPrice(d.length))
        .attr("width", d => xPrice(d.x1)-xPrice(d.x0)-1)
        .attr("height", d => yPrice(0)-yPrice(d.length))
        .attr("fill", "#ff66aa");

    priceSvg.append("g").attr("transform", `translate(0,${height-margin.bottom})`).call(d3.axisBottom(xPrice));
    priceSvg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(yPrice));

    // Rating histogram
    const ratingSvg = d3.select("#rating-chart");
    const xRating = d3.scaleLinear().domain([0,5]).range([margin.left,width-margin.right]);
    const binsRating = d3.bin().domain(xRating.domain()).thresholds(10)(ratings);
    const yRating = d3.scaleLinear().domain([0,d3.max(binsRating,d=>d.length)]).range([height-margin.bottom,margin.top]);

    ratingSvg.selectAll("rect").data(binsRating).enter()
        .append("rect")
        .attr("x", d=>xRating(d.x0)+1)
        .attr("y", d=>yRating(d.length))
        .attr("width", d=>xRating(d.x1)-xRating(d.x0)-1)
        .attr("height", d=>yRating(0)-yRating(d.length))
        .attr("fill","#ff3399");

    ratingSvg.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(xRating));
    ratingSvg.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(yRating));

    // Scatter: Price vs Rating
    const scatterSvg = d3.select("#scatter-chart");
    const xScatter = d3.scaleLinear().domain([0,d3.max(prices)]).range([margin.left, width*2-margin.right]);
    const yScatter = d3.scaleLinear().domain([0,5]).range([height-margin.bottom, margin.top]);

    // Tooltip
    const tooltip = d3.select("body").append("div").attr("class","tooltip");

    scatterSvg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d=>xScatter(d.Price))
        .attr("cy", d=>yScatter(d.Rating))
        .attr("r",5)
        .attr("fill","#ff0066")
        .attr("opacity",0.7)
        .on("mouseover", (event,d)=>{
            tooltip.transition().duration(200).style("opacity",0.9);
            tooltip.html(`<strong>${d["Product Name"]}</strong><br>Brand: ${d.Brand}<br>Price: $${d.Price}<br>Rating: ${d.Rating}/5`)
                .style("left", (event.pageX+10)+"px")
                .style("top", (event.pageY-28)+"px");
        })
        .on("mouseout", ()=> tooltip.transition().duration(500).style("opacity",0));

    scatterSvg.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(xScatter));
    scatterSvg.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(yScatter));

    // Highlight top 5 in scatter
    const topScatter = data.sort((a,b)=>(b.Rating/b.Price)-(a.Rating/a.Price)).slice(0,5);
    scatterSvg.selectAll(".top-circle")
        .data(topScatter)
        .enter()
        .append("circle")
        .attr("class","top-circle")
        .attr("cx", d=>xScatter(d.Price))
        .attr("cy", d=>yScatter(d.Rating))
        .attr("r",7)
        .attr("fill","gold")
        .attr("stroke","#ff0066")
        .attr("stroke-width",2);

    // === STEP 5: Top Recommendations ===
    const topItems = topScatter; // top 5 based on Rating/Price
    const container = d3.select("#recommendation-cards");

    topItems.forEach(item=>{
        const card = container.append("div").attr("class","card");
        card.append("h3").text(item["Product Name"]);
        card.append("p").html(`<strong>Brand:</strong> ${item.Brand}`);
        card.append("p").html(`<strong>Category:</strong> ${item.Category}`);
        card.append("p").html(`<strong>Price:</strong> $${item.Price}`);
        card.append("p").html(`<strong>Rating:</strong> ${item.Rating}/5`);
        card.append("p").html(`<strong>Color:</strong> ${item.Color}`);
        card.append("p").html(`<strong>Size:</strong> ${item.Size}`);
        card.append("div").attr("class","hot-badge").text("🔥 Hot");
    });

    console.log("✅ Full-featured Smart Fashion Recommender loaded!");
}).catch(error=>{
    console.error("Error loading CSV ❌", error);
});
