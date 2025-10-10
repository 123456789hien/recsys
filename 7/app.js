// app.js

// Hàm load CSV từ cùng thư mục (UTF-8, ; separator)
async function loadData() {
    try {
        const response = await fetch('fashion_recommender.csv');
        const data = await response.text();

        const lines = data.trim().split('\n');
        const headers = lines[0].split(';');

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(';');
            if (row.length === headers.length) {
                let obj = {};
                headers.forEach((h, idx) => {
                    let value = row[idx].replace(',', '.'); // chuẩn hóa dấu thập phân
                    if (h === 'Price' || h === 'Rating/5') value = parseFloat(value);
                    obj[h] = value;
                });
                products.push(obj);
            }
        }
        renderTopRecommendations();
        renderEDACharts();
    } catch (err) {
        console.error("Error loading CSV:", err);
    }
}

// ===== Top Recommendations: rating/price =====
function renderTopRecommendations() {
    const container = document.getElementById('top-recommendations');
    const topProducts = products
        .sort((a, b) => (b['Rating/5']/b.Price) - (a['Rating/5']/a.Price))
        .slice(0, 5);

    container.innerHTML = '';
    topProducts.forEach(p => {
        container.innerHTML += `
        <div class="product-card">
            <span class="badge">🔥 Hot</span>
            <h3>${p['Product Name']}</h3>
            <p>Brand: ${p.Brand}</p>
            <p>Category: ${p.Category}</p>
            <p>Price: $${p.Price}</p>
            <p>Rating: ${p['Rating/5']}</p>
            <button onclick="suggestSimilar(${p['Product ID']})">Show Similar</button>
        </div>
        `;
    });
}

// ===== Similar Products =====
function suggestSimilar(productId) {
    const container = document.getElementById('similar-products');
    const product = products.find(p => p['Product ID'] === productId);

    if(!product) return;

    const similar = products
        .filter(p => p['Product ID'] !== productId)
        .sort((a, b) => {
            let distA = Math.abs(a['Rating/5'] - product['Rating/5']) + Math.abs(a.Price - product.Price);
            let distB = Math.abs(b['Rating/5'] - product['Rating/5']) + Math.abs(b.Price - product.Price);
            return distA - distB;
        }).slice(0, 3);

    container.innerHTML = `<h2>Similar to ${product['Product Name']}</h2>`;
    similar.forEach(p => {
        container.innerHTML += `
        <div class="product-card small-card">
            <h4>${p['Product Name']}</h4>
            <p>Price: $${p.Price}, Rating: ${p['Rating/5']}</p>
        </div>
        `;
    });
}

// ===== EDA Charts =====
function renderEDACharts() {
    const ratingCtx = document.getElementById('ratingChart').getContext('2d');
    const ratingData = products.map(p => p['Rating/5']);
    new Chart(ratingCtx, {
        type: 'bar',
        data: {
            labels: ratingData.map((v,i)=>i+1),
            datasets: [{label:'Rating', data: ratingData, backgroundColor:'#FF69B4'}]
        },
        options: { plugins:{legend:{display:false}}}
    });

    const scatterCtx = document.getElementById('scatterChart').getContext('2d');
    new Chart(scatterCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Price vs Rating',
                data: products.map(p => ({x:p['Rating/5'], y:p.Price})),
                backgroundColor:'#FF69B4'
            }]
        },
        options: {
            scales:{
                x:{title:{display:true,text:'Rating'}},
                y:{title:{display:true,text:'Price ($)'}}
            }
        }
    });
}

// Load data khi trang được load
document.addEventListener('DOMContentLoaded', loadData);
