// === Load CSV & initialize ===
d3.csv("fashion_recommender.csv").then(data => {

    // === Parse & Clean Data ===
    data.forEach(d => {
        d.Price = +d.Price.replace(/[^0-9.]/g, '');
        d.Rating = +d['Rating/5'];
    });

    // === EDA Stats ===
    const totalProducts = data.length;
    const prices = data.map(d => d.Price).filter(p => !isNaN(p));
    const avgPrice = (prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(2);
    const maxPrice = Math.max(...prices).toFixed(2);
    const minPrice = Math.min(...prices).toFixed(2);

    document.getElementById("total-products").textContent = totalProducts;
    document.getElementById("avg-price").textContent = avgPrice;
    document.getElementById("max-price").textContent = maxPrice;
    document.getElementById("min-price").textContent = minPrice;

    // === Business Insights ===
    const insights = [
        "Top priced products can target premium customers.",
        "Lower priced products attract budget-sensitive segments.",
        "Most popular categories: " + getTopCategories(data),
        "High rating products can be promoted for trust-building."
    ];
    const ul = document.getElementById("insights-list");
    insights.forEach(i => {
        const li = document.createElement("li");
        li.textContent = i;
        ul.appendChild(li);
    });

    // === Populate filter dropdowns ===
    populateFilter("brand-filter", getUnique(data, "Brand"));
    populateFilter("category-filter", getUnique(data, "Category"));
    populateFilter("size-filter", getUnique(data, "Size"));

    // === Initial Render ===
    renderProducts(data);

    // === Event Listeners for Filters & Sort ===
    document.getElementById("brand-filter").addEventListener("change", () => filterAndRender(data));
    document.getElementById("category-filter").addEventListener("change", () => filterAndRender(data));
    document.getElementById("size-filter").addEventListener("change", () => filterAndRender(data));
    document.getElementById("sort-filter").addEventListener("change", () => filterAndRender(data));

});

// === Helper Functions ===

function getUnique(data, key) {
    return Array.from(new Set(data.map(d => d[key]))).sort();
}

function populateFilter(id, values) {
    const select = document.getElementById(id);
    values.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
    });
}

function getTopCategories(data) {
    const counts = {};
    data.forEach(d => {
        counts[d.Category] = (counts[d.Category] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
}

function renderProducts(data) {
    const container = document.getElementById("product-list");
    container.innerHTML = "";
    data.forEach(d => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
            <h3>${d['Product Name']}</h3>
            <p><b>Brand:</b> ${d.Brand}</p>
            <p><b>Category:</b> ${d.Category}</p>
            <p><b>Price:</b> $${d.Price}</p>
            <p><b>Rating:</b> ${d.Rating}</p>
            <p><b>Size:</b> ${d.Size}</p>
            <p><b>Color:</b> ${d.Color}</p>
        `;
        container.appendChild(card);
    });
}

function filterAndRender(data) {
    let filtered = data;
    const brand = document.getElementById("brand-filter").value;
    const category = document.getElementById("category-filter").value;
    const size = document.getElementById("size-filter").value;
    const sortBy = document.getElementById("sort-filter").value;

    if (brand !== "All") filtered = filtered.filter(d => d.Brand === brand);
    if (category !== "All") filtered = filtered.filter(d => d.Category === category);
    if (size !== "All") filtered = filtered.filter(d => d.Size === size);

    if (sortBy === "price-asc") filtered.sort((a,b)=>a.Price-b.Price);
    if (sortBy === "price-desc") filtered.sort((a,b)=>b.Price-a.Price);
    if (sortBy === "rating-asc") filtered.sort((a,b)=>a.Rating-b.Rating);
    if (sortBy === "rating-desc") filtered.sort((a,b)=>b.Rating-a.Rating);

    renderProducts(filtered);
}
