// Smooth scroll
document.querySelectorAll('nav ul li a').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        target.scrollIntoView({behavior: 'smooth'});
    });
});

// Load data from processed CSVs (use fetch)
let users = [], items = [], interactions = [];

async function loadData() {
    users = await d3.csv("data/processed/users_clean.csv");
    items = await d3.csv("data/processed/items_clean.csv");
    interactions = await d3.csv("data/processed/interactions_clean.csv");

    // Populate user dropdown
    let select = document.getElementById("userSelect");
    users.forEach(u => {
        let opt = document.createElement("option");
        opt.value = u.user_id;
        opt.textContent = `User ${u.user_id}`;
        select.appendChild(opt);
    });

    select.addEventListener("change", updateUser);
    updateUser(); // initial load
}

// Update user history + recommendations
function updateUser() {
    let userId = document.getElementById("userSelect").value;
    let history = interactions.filter(i => i.user_id == userId);
    let historyTable = document.querySelector("#historyTable tbody");
    historyTable.innerHTML = "";
    history.forEach(h => {
        let item = items.find(it => it.item_id == h.item_id);
        let row = `<tr><td>${item.name}</td><td>${h.rating}</td><td>${h.timestamp}</td></tr>`;
        historyTable.innerHTML += row;
    });

    // Simple Top-N recommendations (most popular items not bought)
    let purchased = new Set(history.map(h=>h.item_id));
    let topItems = interactions
        .filter(i => !purchased.has(i.item_id))
        .reduce((acc, cur) => {
            acc[cur.item_id] = (acc[cur.item_id]||0) + parseInt(cur.rating);
            return acc;
        }, {});
    let sorted = Object.entries(topItems).sort((a,b)=>b[1]-a[1]).slice(0,10);

    let recTable = document.querySelector("#recTable tbody");
    recTable.innerHTML = "";
    sorted.forEach(([item_id,_]) => {
        let it = items.find(it=>it.item_id==item_id);
        let row = `<tr><td>${it.name}</td><td>${it.price}</td></tr>`;
        recTable.innerHTML += row;
    });
}

// EDA charts
function drawCharts() {
    let ratings = interactions.map(i=>+i.rating);
    let topItemsCount = {};
    interactions.forEach(i=>{
        topItemsCount[i.item_id] = (topItemsCount[i.item_id]||0)+1;
    });
    let topItems = Object.entries(topItemsCount).sort((a,b)=>b[1]-a[1]).slice(0,10);

    // Rating distribution
    new Chart(document.getElementById("ratingChart"), {
        type: 'bar',
        data: {
            labels: Array.from(new Set(ratings)),
            datasets: [{
                label: 'Rating Distribution',
                data: ratings.reduce((a,c)=>{
                    a[c] = (a[c]||0)+1; return a;
                }, []),
                backgroundColor: '#ff69b4'
            }]
        }
    });

    // Top items chart
    new Chart(document.getElementById("topItemsChart"), {
        type: 'bar',
        data: {
            labels: topItems.map(t=>t[0]),
            datasets: [{
                label: 'Top 10 Popular Items',
                data: topItems.map(t=>t[1]),
                backgroundColor: '#ff1493'
            }]
        }
    });
}

// Load data and draw charts
loadData().then(drawCharts);
