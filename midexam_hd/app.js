const dataUrl = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/midexam_hd/fashion_recommender.csv";
let fashionData = [];

d3.csv(dataUrl).then(data => {
    fashionData = data.map(d => ({
        ProductID: d.ProductID.trim(),
        Name: d.Name.trim(),
        Brand: d.Brand.trim(),
        Category: d.Category.trim(),
        Price: +d.Price,
        Rating: +d.Rating,
        Color: d.Color.trim(),
        Size: d.Size.trim(),
        UserID: d.UserID.trim()
    }));
    initDashboard();
});

function initDashboard() {
    const categorySelect = d3.select("#categorySelect");
    const productSelect = d3.select("#productSelect");

    categorySelect.on("change", updateAll);
    d3.select("#showSimilarBtn").on("click", showSimilarProducts);

    updateAll();

    function updateAll() {
        const category = categorySelect.property("value");
        const filtered = category === "All" ? fashionData : fashionData.filter(d => d.Category === category);
        updateTopRecommendations(filtered);
        updateEDA(filtered);
        updateProductSelect(filtered);
        updateTop10Tables(filtered);
    }

    function updateProductSelect(filtered) {
        const productNames = [...new Set(filtered.map(d => d.Name))];
        const select = productSelect.selectAll("option")
            .data(["", ...productNames]);
        select.join("option")
            .attr("value", d => d)
            .text(d => d === "" ? "-- Choose Product Name --" : d);
    }

    function updateTopRecommendations(filtered) {
        const top = filtered.sort((a, b) => b.Rating - a.Rating || a.Price - b.Price).slice(0, 8);
        const cards = d3.select("#recommendations").selectAll(".card").data(top);
        const tooltip = createTooltip();

        cards.join("div")
            .attr("class", "card")
            .html(d => `<b>${d.ProductID} - ${d.Name}</b><br>${d.Brand}<br>⭐ ${d.Rating} | 💲${d.Price}<br><span class='badge'>🔥 Hot</span>`)
            .on("mousemove", (event, d) => showTooltip(event, tooltip, `Color: ${d.Color}<br>Size: ${d.Size}`))
            .on("mouseleave", () => hideTooltip(tooltip));
    }

    function updateEDA(filtered) {
        d3.select("#ratingDist").html("");
        d3.select("#priceDist").html("");
        d3.select("#priceVsRating").html("");
        d3.select("#avgRatingPerBrand").html("");

        drawBarChart(filtered, "Rating", "#ratingDist", "Distribution of Ratings");
        drawBarChart(filtered, "Price", "#priceDist", "Distribution of Prices");
        drawScatterPlot(filtered, "#priceVsRating", "Price vs Rating");
        drawAverageRatingPerBrand(filtered, "#avgRatingPerBrand", "Average Rating per Brand");
    }

    function showSimilarProducts() {
        const category = categorySelect.property("value");
        const productName = productSelect.property("value");
        const filtered = fashionData.filter(d => (category === "All" || d.Category === category) && d.Name === productName);

        if (filtered.length === 0) return;

        const target = filtered[0];
        const categoryData = fashionData.filter(d => d.Category === target.Category && d.Name !== target.Name);

        const sims = categoryData.map(d => {
            const vecA = normalize([target.Rating, target.Price]);
            const vecB = normalize([d.Rating, d.Price]);
            const sim = cosineSimilarity(vecA, vecB);
            return { ...d, similarity: sim };
        }).sort((a, b) => b.similarity - a.similarity).slice(0, 6);

        const cards = d3.select("#similarProducts").selectAll(".card").data(sims);
        const tooltip = createTooltip();

        cards.join("div")
            .attr("class", "card")
            .html(d => `<b>${d.ProductID}</b><br>${d.Brand}<br>⭐ ${d.Rating} | 💲${d.Price}<br><i>Sim: ${d.similarity.toFixed(3)}</i>`)
            .on("mousemove", (event, d) => showTooltip(event, tooltip, `Color: ${d.Color}<br>Size: ${d.Size}`))
            .on("mouseleave", () => hideTooltip(tooltip));

        updatePurchaseHistory(filtered);
        updateTop10Tables(filtered);
    }

    function updatePurchaseHistory(filtered) {
        const table = d3.select("#purchaseHistory").html("")
            .append("table").attr("class", "data-table");
        const header = ["ProductID", "UserID", "Brand", "Rating", "Price"];
        table.append("thead").append("tr").selectAll("th").data(header).join("th").text(d => d);
        table.append("tbody").selectAll("tr").data(filtered).join("tr")
            .selectAll("td").data(d => header.map(k => d[k])).join("td").text(d => d);
    }

    function updateTop10Tables(filtered) {
        const byRating = filtered.sort((a, b) => b.Rating - a.Rating).slice(0, 10);
        const minPrice = d3.min(filtered, d => d.Price), maxPrice = d3.max(filtered, d => d.Price);
        const minRating = d3.min(filtered, d => d.Rating), maxRating = d3.max(filtered, d => d.Rating);

        const byScore = filtered.map(d => {
            const normRating = (d.Rating - minRating) / (maxRating - minRating);
            const normPrice = (d.Price - minPrice) / (maxPrice - minPrice);
            const score = 0.5 * normRating + 0.3 * normPrice + 0.2 * Math.random();
            return { ...d, Score: score };
        }).sort((a, b) => b.Score - a.Score).slice(0, 10);

        const tablesDiv = d3.select("#top10Tables").html("");
        drawTable(tablesDiv, byRating, "Top 10 by Rating");
        drawTable(tablesDiv, byScore, "Top 10 by Score");
    }
}

// ---------- Helper Functions ----------
function normalize(v) {
    const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    return v.map(x => x / norm);
}
function cosineSimilarity(a, b) {
    return a.map((v, i) => v * b[i]).reduce((a, b) => a + b, 0);
}
function createTooltip() {
    let tooltip = d3.select("body").selectAll(".tooltip").data([null]).join("div").attr("class", "tooltip");
    return tooltip;
}
function showTooltip(event, tooltip, html) {
    tooltip.style("display", "block").html(html)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 20 + "px");
}
function hideTooltip(tooltip) {
    tooltip.style("display", "none");
}
function drawTable(div, data, title) {
    div.append("h3").text(title);
    const table = div.append("table").attr("class", "data-table");
    const header = Object.keys(data[0]);
    table.append("thead").append("tr").selectAll("th").data(header).join("th").text(d => d);
    table.append("tbody").selectAll("tr").data(data).join("tr")
        .selectAll("td").data(d => header.map(k => d[k])).join("td").text(d => typeof d === "number" ? d.toFixed(2) : d);
}
function drawBarChart(data, field, container, title) {
    const svg = d3.select(container).append("svg").attr("width", 400).attr("height", 250);
    svg.append("text").attr("x", 200).attr("y", 20).attr("text-anchor", "middle").text(title);
    const x = d3.scaleLinear().domain(d3.extent(data, d => d[field])).nice().range([40, 380]);
    const bins = d3.histogram().value(d => d[field]).domain(x.domain()).thresholds(10)(data);
    const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).nice().range([220, 40]);
    const g = svg.append("g");
    const tooltip = createTooltip();
    g.selectAll("rect").data(bins).join("rect")
        .attr("x", d => x(d.x0)).attr("y", d => y(d.length))
        .attr("width", d => x(d.x1) - x(d.x0) - 2).attr("height", d => 220 - y(d.length))
        .attr("fill", "#4a90e2")
        .on("mousemove", (e, d) => showTooltip(e, tooltip, `${field}: ${d.x0.toFixed(1)} - ${d.x1.toFixed(1)}<br>Count: ${d.length}`))
        .on("mouseleave", () => hideTooltip(tooltip));
}
function drawScatterPlot(data, container, title) {
    const svg = d3.select(container).append("svg").attr("width", 400).attr("height", 250);
    svg.append("text").attr("x", 200).attr("y", 20).attr("text-anchor", "middle").text(title);
    const x = d3.scaleLinear().domain(d3.extent(data, d => d.Price)).nice().range([40, 380]);
    const y = d3.scaleLinear().domain(d3.extent(data, d => d.Rating)).nice().range([220, 40]);
    const tooltip = createTooltip();
    svg.selectAll("circle").data(data).join("circle")
        .attr("cx", d => x(d.Price)).attr("cy", d => y(d.Rating)).attr("r", 4).attr("fill", "#ff6b6b")
        .on("mousemove", (e, d) => showTooltip(e, tooltip, `Price: ${d.Price}<br>Rating: ${d.Rating}`))
        .on("mouseleave", () => hideTooltip(tooltip));
}
function drawAverageRatingPerBrand(data, container, title) {
    const brandAvg = Array.from(d3.rollup(data, v => d3.mean(v, d => d.Rating), d => d.Brand), ([Brand, Rating]) => ({Brand, Rating}));
    const svg = d3.select(container).append("svg").attr("width", 400).attr("height", 250);
    svg.append("text").attr("x", 200).attr("y", 20).attr("text-anchor", "middle").text(title);
    const x = d3.scaleBand().domain(brandAvg.map(d => d.Brand)).range([40, 380]).padding(0.2);
    const y = d3.scaleLinear().domain([0, d3.max(brandAvg, d => d.Rating)]).nice().range([220, 40]);
    const tooltip = createTooltip();
    svg.selectAll("rect").data(brandAvg).join("rect")
        .attr("x", d => x(d.Brand)).attr("y", d => y(d.Rating))
        .attr("width", x.bandwidth()).attr("height", d => 220 - y(d.Rating))
        .attr("fill", "#feca57")
        .on("mousemove", (e, d) => showTooltip(e, tooltip, `${d.Brand}: ${d.Rating.toFixed(2)}`))
        .on("mouseleave", () => hideTooltip(tooltip));
}
