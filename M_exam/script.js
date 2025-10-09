let selectedUser = null;
let filteredUsers = [];

// Notes utility
function addNote(msg) {
    const ul = document.getElementById('notes-list');
    const li = document.createElement('li');
    li.innerText = msg;
    ul.appendChild(li);
}

// Initialize page
window.onload = async () => {
    try {
        addNote("🔄 Loading data...");
        await loadData();
        populateLocationDropdown();
        addNote("✅ Location dropdown populated");
    } catch (err) {
        console.error(err);
        addNote(`❌ Error loading data: ${err.message}`);
    }

    document.getElementById('location-select').addEventListener('change', filterUsersByLocation);
    document.getElementById('user-select').addEventListener('change', selectUser);
    document.getElementById('compute-btn').addEventListener('click', computeRecommendations);
};

function populateLocationDropdown() {
    const locations = Array.from(new Set(users.map(u => u.location))).sort();
    const locSelect = document.getElementById('location-select');
    locations.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.innerText = loc;
        locSelect.appendChild(opt);
    });
}

function filterUsersByLocation() {
    const loc = document.getElementById('location-select').value;
    filteredUsers = loc === 'all' ? users : users.filter(u => u.location === loc);
    const userSelect = document.getElementById('user-select');
    userSelect.innerHTML = '<option value="">--Select User--</option>';
    filteredUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.user_id;
        opt.innerText = u.user_id;
        userSelect.appendChild(opt);
    });
    addNote(`✅ Users filtered by location: ${loc}`);
}

function selectUser() {
    selectedUser = document.getElementById('user-select').value;
    displayUserHistory();
    addNote(`✅ User selected: ${selectedUser}`);
}

function displayUserHistory() {
    const tbody = document.querySelector('#history-table tbody');
    tbody.innerHTML = '';
    if (!selectedUser) return;
    const history = interactions.filter(i => i.user_id === selectedUser)
        .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    history.forEach((i) => {
        const item = items.find(it => it.item_id === i.item_id);
        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.name}</td><td>${item.price}</td><td>${i.rating}</td><td>${i.timestamp}</td>`;
        tbody.appendChild(row);
    });
    addNote(`✅ Displayed ${history.length} purchases for user`);
}

// Recommendations
function computeRecommendations() {
    if (!selectedUser) {
        alert("Select a user first!");
        return;
    }
    addNote("🔄 Computing recommendations...");

    // Compute Top-N for 3 categories
    const userEmb = embeddings[selectedUser];
    if (!userEmb) {
        addNote("❌ No embedding found for user");
        return;
    }

    const scores = items.map(it => {
        const itemEmb = embeddings[it.item_id];
        const sim = itemEmb ? cosineSimilarity(userEmb, itemEmb) : 0;
        const rating = averageRating(it.item_id);
        const price = it.price;
        return {
            item_id: it.item_id,
            name: it.name,
            price,
            rating,
            sim,
            best_value: rating / price,
            highest_rated: rating,
            most_similar: sim
        };
    });

    renderTopN('best-value-table', scores, 'best_value');
    renderTopN('highest-rated-table', scores, 'highest_rated');
    renderTopN('most-similar-table', scores, 'most_similar');

    updateEDACharts();
    addNote("✅ Recommendations computed and displayed");
}

function averageRating(item_id) {
    const ratings = interactions.filter(i => i.item_id === item_id).map(i => i.rating);
    if (ratings.length === 0) return 0;
    return ratings.reduce((a,b) => a+b,0)/ratings.length;
}

function renderTopN(tableId, scores, key) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';
    const top = scores.sort((a,b) => b[key]-a[key]).slice(0,10);
    top.forEach((s,i) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${i+1}</td><td>${s.name}</td><td>${s.price}</td><td>${s.rating}</td>`;
        tbody.appendChild(row);
    });
}

// Cosine similarity
function cosineSimilarity(a,b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i=0;i<a.length;i++) {
        dot += a[i]*b[i];
        normA += a[i]*a[i];
        normB += b[i]*b[i];
    }
    return dot / (Math.sqrt(normA)*Math.sqrt(normB)+1e-8);
}

// EDA Charts
let ratingChart = null, priceChart = null;
function updateEDACharts() {
    const userHistory = interactions.filter(i => i.user_id === selectedUser);
    const ratingData = userHistory.map(i => i.rating);
    const priceData = userHistory.map(i => {
        const item = items.find(it => it.item_id === i.item_id);
        return item ? item.price : 0;
    });

    if (ratingChart) ratingChart.destroy();
    if (priceChart) priceChart.destroy();

    ratingChart = new Chart(document.getElementById('rating-chart').getContext('2d'), {
        type: 'bar',
        data: { labels: ratingData.map((_,i)=>i+1), datasets: [{label:'Rating', data: ratingData, backgroundColor:'#d63384'}]},
        options: { responsive:true, plugins:{legend:{display:false}}}
    });

    priceChart = new Chart(document.getElementById('price-chart').getContext('2d'), {
        type: 'bar',
        data: { labels: priceData.map((_,i)=>i+1), datasets: [{label:'Price', data: priceData, backgroundColor:'#ff66a3'}]},
        options: { responsive:true, plugins:{legend:{display:false}}}
    });
}
