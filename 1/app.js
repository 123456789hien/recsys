// Sections toggle
const edaBtn = document.getElementById("edaBtn");
const recBtn = document.getElementById("recBtn");
const searchBtn = document.getElementById("searchBtn");

const edaSection = document.getElementById("edaSection");
const recSection = document.getElementById("recSection");
const searchSection = document.getElementById("searchSection");

edaBtn.addEventListener("click", () => {
    edaSection.classList.add("active-section");
    recSection.classList.remove("active-section");
    searchSection.classList.remove("active-section");
});

recBtn.addEventListener("click", () => {
    edaSection.classList.remove("active-section");
    recSection.classList.add("active-section");
    searchSection.classList.remove("active-section");
});

searchBtn.addEventListener("click", () => {
    edaSection.classList.remove("active-section");
    recSection.classList.remove("active-section");
    searchSection.classList.add("active-section");
});

// Load CSV data
let fashionData = [];
fetch('fashion_recommender.csv')
    .then(response => response.text())
    .then(data => {
        fashionData = CSVToArray(data);
        renderEDA();
    });

// Simple CSV parser
function CSVToArray(strData, strDelimiter = ",") {
    const objPattern = new RegExp(
        `(\\${strDelimiter}|\\r?\\n|\\r|^)` +
        `(?:"([^"]*(?:""[^"]*)*)"|([^"${strDelimiter}\\r\\n]*))`,
        "gi"
    );
    const arrData = [[]];
    let arrMatches = null;
    while (arrMatches = objPattern.exec(strData)) {
        const strMatchedDelimiter = arrMatches[1];
        if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
            arrData.push([]);
        }
        const strMatchedValue = arrMatches[2] ? 
            arrMatches[2].replace(new RegExp('""', 'g'), '"') :
            arrMatches[3];
        arrData[arrData.length - 1].push(strMatchedValue);
    }
    return arrData;
}

// EDA rendering
function renderEDA() {
    const edaDiv = document.getElementById("edaContent");
    if (fashionData.length <= 1) return;
    const headers = fashionData[0];
    const rows = fashionData.slice(1);

    // Price distribution example
    const prices = rows.map(r => parseFloat(r[5]));
    const avgPrice = (prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(2);
    const maxPrice = Math.max(...prices).toFixed(2);
    const minPrice = Math.min(...prices).toFixed(2);

    edaDiv.innerHTML = `
        <p><strong>Total Products:</strong> ${rows.length}</p>
        <p><strong>Average Price:</strong> $${avgPrice}</p>
        <p><strong>Max Price:</strong> $${maxPrice}, <strong>Min Price:</strong> $${minPrice}</p>
        <p><em>Insights:</em> Top priced products can target premium customers, lower priced for budget-sensitive segments.</p>
    `;
}

// Simple Recommendations based on Rating & Price similarity
document.getElementById("getRec").addEventListener("click", () => {
    const userId = parseInt(document.getElementById("userId").value);
    const recDiv = document.getElementById("recResults");
    if (!userId) {
        recDiv.innerHTML = "<p>Please enter a valid User ID</p>";
        return;
    }
    // Example: top 5 highest-rated products
    const rows = fashionData.slice(1);
    const top5 = rows.sort((a,b)=>parseFloat(b[6])-parseFloat(a[6])).slice(0,5);
    recDiv.innerHTML = top5.map(r => `<div class="product-card">
        <p><strong>${r[2]}</strong> (${r[3]}, ${r[4]})</p>
        <p>Price: $${r[5]}, Rating: ${parseFloat(r[6]).toFixed(2)}</p>
        <p>Color: ${r[7]}, Size: ${r[8]}</p>
    </div>`).join("");
});

// Search functionality
document.getElementById("searchBtnAction").addEventListener("click", () => {
    const query = document.getElementById("searchQuery").value.toLowerCase();
    const searchDiv = document.getElementById("searchResults");
    if (!query) {
        searchDiv.innerHTML = "<p>Please enter a search term</p>";
        return;
    }
    const rows = fashionData.slice(1);
    const results = rows.filter(r => r.some(val => val.toLowerCase().includes(query)));
    if (!results.length) {
        searchDiv.innerHTML = "<p>No products found</p>";
        return;
    }
    searchDiv.innerHTML = results.map(r => `<div class="product-card">
        <p><strong>${r[2]}</strong> (${r[3]}, ${r[4]})</p>
        <p>Price: $${r[5]}, Rating: ${parseFloat(r[6]).toFixed(2)}</p>
        <p>Color: ${r[7]}, Size: ${r[8]}</p>
    </div>`).join("");
});
