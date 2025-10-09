// Global variables
let users = [], items = [], interactions = [], recommendations = [];

// Load CSV files and parse
async function loadData() {
    try {
        users = await loadCSV("data/processed/users_clean.csv");
        items = await loadCSV("data/processed/items_clean.csv");
        interactions = await loadCSV("data/processed/interactions_clean.csv");

        // Precompute top-N popular items for fallback recommendation
        computeRecommendations();

        populateUserDropdown();
    } catch(err) {
        console.error("Error loading data:", err);
        alert("Failed to load data. Check CSV paths.");
    }
}

function loadCSV(url){
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            dynamicTyping: true,
            complete: results => resolve(results.data),
            error: err => reject(err)
        });
    });
}

// Precompute top recommendations per user (simple popularity-based CF)
function computeRecommendations(){
    let itemCounts = {};
    interactions.forEach(i => {
        itemCounts[i.item_id] = (itemCounts[i.item_id] || 0) + 1;
    });
    let topItems = Object.entries(itemCounts)
        .sort((a,b)=>b[1]-a[1])
        .map(t=>t[0]);

    users.forEach(u=>{
        recommendations[u.user_id] = topItems.map(id=>{
            let it = items.find(itm => itm.item_id==id);
            return {item_id: id, name: it ? it.name : "", price: it ? it.price : 0};
        });
    });
}

// Populate user dropdown
function populateUserDropdown(){
    let select = document.getElementById("userSelect");
    users.forEach(u=>{
        let opt = document.createElement("option");
        opt.value = u.user_id;
        opt.textContent = `User ${u.user_id}`;
        select.appendChild(opt);
    });
    select.addEventListener("change", updateUser);
    updateUser();
}
