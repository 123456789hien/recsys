// Global variables
let ratingChart = null;
let priceChart = null;

// Upload CSVs
document.getElementById("uploadUsers").addEventListener("change", function(e){
    parseCSV(e.target.files[0], (data)=>{
        users = data;
        document.getElementById("noteUsers").innerText = "Users CSV loaded ✅";
        populateLocations();
    });
});

document.getElementById("uploadItems").addEventListener("change", function(e){
    parseCSV(e.target.files[0], (data)=>{
        items = data;
        document.getElementById("noteItems").innerText = "Items CSV loaded ✅";
    });
});

document.getElementById("uploadInteractions").addEventListener("change", function(e){
    parseCSV(e.target.files[0], (data)=>{
        interactions = data;
        document.getElementById("noteInteractions").innerText = "Interactions CSV loaded ✅";
    });
});

// Populate location dropdown
function populateLocations(){
    const locationSelect = document.getElementById("locationSelect");
    const locations = [...new Set(users.map(u=>u.location))];
    locations.forEach(loc=>{
        const option = document.createElement("option");
        option.value = loc;
        option.innerText = loc;
        locationSelect.appendChild(option);
    });
}

// Populate user dropdown based on location
document.getElementById("locationSelect").addEventListener("change", function(){
    const loc = this.value;
    const userSelect = document.getElementById("userSelect");
    userSelect.innerHTML = '<option value="">Select a User</option>';
    const filtered = loc === "all" ? users : users.filter(u=>u.location===loc);
    filtered.forEach(u=>{
        const option = document.createElement("option");
        option.value = u.user_id;
        option.innerText = u.user_id;
        userSelect.appendChild(option);
    });
    document.getElementById("noteLocation").innerText = `Filtered ${filtered.length} users ✅`;
});

// Display user purchase history + EDA charts
document.getElementById("userSelect").addEventListener("change", function(){
    const userId = this.value;
    if(!userId) return;
    const userInteractions = interactions.filter(i=>i.user_id===userId);
    displayPurchaseHistory(userInteractions);
});

function displayPurchaseHistory(userInteractions){
    const tbody = document.querySelector("#purchaseHistoryTable tbody");
    tbody.innerHTML = "";
    userInteractions.forEach(i=>{
        const item = items.find(it=>it.item_id===i.item_id);
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${item?.name || i.item_id}</td><td>${item?.price || ""}</td><td>${i.rating}</td><td>${i.timestamp}</td>`;
        tbody.appendChild(tr);
    });
    updateEDACharts(userInteractions);
    document.getElementById("noteUser").innerText = `Displayed ${userInteractions.length} interactions ✅`;
}

// Update Rating & Price charts
function updateEDACharts(userInteractions){
    const ratings = userInteractions.map(i=>+i.rating);
    const prices = userInteractions.map(i=>{
        const item = items.find(it=>it.item_id===i.item_id);
        return item ? +item.price : 0;
    });
    const ratingCtx = document.getElementById("ratingChart").getContext("2d");
    const priceCtx = document.getElementById("priceChart").getContext("2d");

    if(ratingChart) ratingChart.destroy();
    if(priceChart) priceChart.destroy();

    ratingChart = new Chart(ratingCtx, {
        type: "bar",
        data: { labels: ratings.map((_,i)=>i+1), datasets:[{label:"Ratings Distribution",data:ratings,backgroundColor:"#ff66b2"}]},
        options: { responsive:true, plugins:{title:{display:true,text:"Rating Distribution"}}}
    });

    priceChart = new Chart(priceCtx, {
        type: "bar",
        data: { labels: prices.map((_,i)=>i+1), datasets:[{label:"Price Distribution",data:prices,backgroundColor:"#ff99cc"}]},
        options: { responsive:true, plugins:{title:{display:true,text:"Price Distribution"}}}
    });
}

// Top-N Recommendations placeholder
document.getElementById("computeRecommendations").addEventListener("click", function(){
    const userId = document.getElementById("userSelect").value;
    if(!userId){ alert("Please select a user first"); return; }
    document.getElementById("noteRecom").innerText = "Computing recommendations... 🔄";

    // Here you would use Collaborative Filtering + uploaded embeddings + smart weighting
    // For now, just show top 10 random items for demo
    const top10 = items.slice(0,10);
    displayTopN(top10);
    document.getElementById("noteRecom").innerText = "Top-10 recommendations displayed ✅";
});

function displayTopN(topItems){
    const tbody = document.querySelector("#topNTable tbody");
    tbody.innerHTML = "";
    for(let i=0;i<topItems.length;i++){
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${topItems[i].name}</td><td>${topItems[i].name}</td><td>${topItems[i].name}</td>`;
        tbody.appendChild(tr);
    }
}
