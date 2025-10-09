window.onload = async function() {
    await loadData();
    populateLocationButtons();
    populateUserDropdown();
};

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

// Populate users dropdown
function populateUserDropdown(filteredUsers=null) {
    const select = document.getElementById("user-select");
    select.innerHTML = '<option value="">-- Select User --</option>';
    const list = filteredUsers || users;
    list.forEach(u=>{
        const option = document.createElement("option");
        option.value = u.user_id;
        option.innerText = u.user_id;
        select.appendChild(option);
    });
    document.getElementById("user-note").innerText = "✅ Users ready.";
}

function filterUsersByLocation(loc) {
    const filtered = loc==="All"?users:users.filter(u=>u.location===loc);
    populateUserDropdown(filtered);
    document.getElementById("user-note").innerText = `✅ Users filtered by location: ${loc}`;
}

// Two-Tower Embeddings
let userEmbeddings = {};
let itemEmbeddings = {};

function createEmbeddings() {
    users.forEach(u=>userEmbeddings[u.user_id] = tf.randomNormal([8]));
    items.forEach(it=>itemEmbeddings[it.item_id] = tf.randomNormal([8]));
    document.getElementById("status-note").innerText += " ✅ Embeddings initialized.";
}

function computeSimilarity(user_id) {
    const userVec = userEmbeddings[user_id];
    const scores = {};
    items.forEach(it=>{
        scores[it.item_id] = tf.tidy(()=>{
            return tf.dot(userVec, itemEmbeddings[it.item_id]).dataSync()[0];
        });
    });
    return scores;
}

// Recommendation
document.getElementById("recommend-btn").onclick = function() {
    const user_id = document.getElementById("user-select").value;
    if(!user_id){ alert("Please select a user"); return; }
    document.getElementById("recommend-note").innerText = "🔄 Computing recommendations...";

    createEmbeddings();
    const simScores = computeSimilarity(user_id);

    // Aggregate ratings
    const aggScores = {};
    interactions.forEach(i=>{
        if(i.user_id===user_id) return;
        aggScores[i.item_id] = (aggScores[i.item_id]||0) + i.rating;
    });

    // Compute top-N
    const topN = items.map(it=>{
        const s = (simScores[it.item_id]||0) + (aggScores[it.item_id]||0)/10;
        const score = it.price>0 ? s/it.price : s;
        return {...it, score};
    }).sort((a,b)=>b.score-a.score).slice(0,10);

    // Display top-N table
    const tbody = document.querySelector("#recommendation-table tbody");
    tbody.innerHTML = "";
    topN.forEach((item, idx)=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${idx+1}</td><td>${item.name}</td><td>-</td><td>$${item.price.toFixed(2)}</td><td>${item.score.toFixed(2)}</td>`;
        tbody.appendChild(tr);
    });

    document.getElementById("recommend-note").innerText = "✅ Recommendations computed.";
    updateUserHistory(user_id);
    updateEDA(user_id);
};

// User history
function updateUserHistory(user_id){
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

// EDA
function updateEDA(user_id){
    const hist = interactions.filter(i=>i.user_id===user_id);
    const ratings = hist.map(h=>h.rating);
    const prices = hist.map(h=>{
        const item = items.find(it=>it.item_id===h.item_id);
        return item?item.price:0;
    });
    const ctx = document.getElementById("eda-chart").getContext('2d');
    if(window.edaChart) window.edaChart.destroy();
    window.edaChart = new Chart(ctx,{
        type:'scatter',
        data:{
            datasets:[{
                label:'Rating vs Price',
                data: ratings.map((r,i)=>({x:prices[i], y:r})),
                backgroundColor:'#e60073'
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
