window.onload = async function() {
    await loadData();
    populateUserDropdown();
    populateLocationButtons();
};

// Populate users dropdown
function populateUserDropdown() {
    const select = document.getElementById("user-select");
    users.forEach(u=>{
        const option = document.createElement("option");
        option.value = u.user_id;
        option.innerText = u.user_id;
        select.appendChild(option);
    });
    document.getElementById("user-note").innerText = "✅ Users loaded.";
}

// Populate location buttons
function populateLocationButtons() {
    const container = document.getElementById("location-buttons");
    const locations = [...new Set(users.map(u=>u.location))].filter(l=>l && l.trim()!=="");
    locations.forEach(loc=>{
        const btn = document.createElement("button");
        btn.className = "location-btn";
        btn.dataset.location = loc;
        btn.innerText = loc;
        btn.onclick = ()=>filterUsersByLocation(loc);
        container.appendChild(btn);
    });
    document.getElementById("location-note").innerText = "✅ Locations ready.";
}

function filterUsersByLocation(loc) {
    const select = document.getElementById("user-select");
    select.innerHTML = '<option value="">-- Select User --</option>';
    let filtered = loc === "All" ? users : users.filter(u=>u.location===loc);
    filtered.forEach(u=>{
        const option = document.createElement("option");
        option.value = u.user_id;
        option.innerText = u.user_id;
        select.appendChild(option);
    });
    document.getElementById("user-note").innerText = `✅ Users filtered by location: ${loc}`;
}

// Compute user similarity (simple cosine on item ratings)
function computeUserSimilarity(targetUser) {
    const userMap = {};
    users.forEach(u=>{
        userMap[u.user_id] = interactions.filter(i=>i.user_id===u.user_id)
                                        .reduce((acc,i)=>{acc[i.item_id]=i.rating; return acc;},{});
    });

    const targetRatings = userMap[targetUser];
    const scores = {};
    users.forEach(u=>{
        if(u.user_id === targetUser) return;
        const ratings = userMap[u.user_id];
        const commonItems = Object.keys(ratings).filter(item=>item in targetRatings);
        if(commonItems.length===0){ scores[u.user_id]=0; return; }
        let dot=0, normA=0, normB=0;
        commonItems.forEach(item=>{
            dot += ratings[item]*targetRatings[item];
            normA += ratings[item]*ratings[item];
            normB += targetRatings[item]*targetRatings[item];
        });
        scores[u.user_id] = dot / (Math.sqrt(normA)*Math.sqrt(normB));
    });
    return scores;
}

// Top-N Recommendation
document.getElementById("recommend-btn").onclick = function() {
    const user_id = document.getElementById("user-select").value;
    if(!user_id) { alert("Please select a user"); return; }
    document.getElementById("recommend-note").innerText = "🔄 Computing recommendations...";
    
    const similarity = computeUserSimilarity(user_id);

    // Aggregate item scores
    const scoredItems = {};
    interactions.forEach(i=>{
        if(i.user_id === user_id) return;
        scoredItems[i.item_id] = (scoredItems[i.item_id] || 0) + i.rating*similarity[i.user_id];
    });

    // Normalize with price
    const topN = Object.entries(scoredItems)
                    .map(([item_id, score])=>{
                        const item = items.find(it=>it.item_id===item_id);
                        const valueScore = item.price>0 ? score / item.price : score;
                        return {...item, score:valueScore};
                    })
                    .sort((a,b)=>b.score - a.score)
                    .slice(0,10);

    // Display table
    const tbody = document.querySelector("#recommendation-table tbody");
    tbody.innerHTML = "";
    topN.forEach((item, idx)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${idx+1}</td>
                        <td>${item.name}</td>
                        <td>Fashion</td>
                        <td>-</td>
                        <td>$${item.price.toFixed(2)}</td>`;
        tbody.appendChild(tr);
    });
    document.getElementById("recommend-note").innerText = "✅ Recommendations computed.";
    updateUserHistory(user_id);
    updateEDA(user_id);
};

// Display user history
function updateUserHistory(user_id) {
    const hist = interactions.filter(i=>i.user_id===user_id);
    const tbody = document.querySelector("#history-table tbody");
    tbody.innerHTML = "";
    hist.forEach(h=>{
        const item = items.find(it=>it.item_id===h.item_id);
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${item?item.name:h.item_id}</td>
                        <td>${h.rating}</td>
                        <td>$${item?item.price.toFixed(2):'-'}</td>
                        <td>${h.timestamp}</td>`;
        tbody.appendChild(tr);
    });
}

// EDA Chart
function updateEDA(user_id) {
    const hist = interactions.filter(i=>i.user_id===user_id);
    const ratings = hist.map(h=>h.rating);
    const prices = hist.map(h=>{
        const item = items.find(it=>it.item_id===h.item_id);
        return item?item.price:0;
    });
    const ctx = document.getElementById("eda-chart").getContext('2d');
    if(window.edaChart) window.edaChart.destroy();
    window.edaChart = new Chart(ctx,{
        type: 'scatter',
        data: {
            datasets:[{
                label: 'Rating vs Price',
                data: ratings.map((r,i)=>({x:prices[i], y:r})),
                backgroundColor: '#e60073'
            }]
        },
        options:{
            responsive:true,
            plugins:{legend:{display:false}},
            scales:{
                x:{title:{display:true,text:'Price ($)'}},
                y:{title:{display:true,text:'Rating'}}
            }
        }
    });
}
