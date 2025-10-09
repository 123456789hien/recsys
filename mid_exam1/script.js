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

// Prepare two-tower embeddings dataset
function createDataset() {
    const userIds = [...new Set(interactions.map(i=>i.user_id))];
    const itemIds = [...new Set(interactions.map(i=>i.item_id))];
    const userIndex = {}; userIds.forEach((u,i)=>userIndex[u]=i);
    const itemIndex = {}; itemIds.forEach((it,i)=>itemIndex[it]=i);

    const xs_user = []; const xs_item = []; const ys = [];
    interactions.forEach(i=>{
        xs_user.push(userIndex[i.user_id]);
        xs_item.push(itemIndex[i.item_id]);
        ys.push(i.rating/10.0); // normalize rating
    });

    return {userIds, itemIds, userIndex, itemIndex,
            xs_user: tf.tensor1d(xs_user,'int32'),
            xs_item: tf.tensor1d(xs_item,'int32'),
            ys: tf.tensor1d(ys,'float32')};
}

// Build Two-Tower model
function buildTwoTower(numUsers, numItems, embedSize=8){
    const userInput = tf.input({shape:[], dtype:'int32'});
    const itemInput = tf.input({shape:[], dtype:'int32'});

    const userEmbed = tf.layers.embedding({inputDim:numUsers, outputDim:embedSize})(userInput);
    const itemEmbed = tf.layers.embedding({inputDim:numItems, outputDim:embedSize})(itemInput);

    const dot = tf.layers.dot({axes:1})([userEmbed, itemEmbed]);
    const output = tf.layers.flatten().apply(dot);

    const model = tf.model({inputs:[userInput,itemInput], outputs:output});
    model.compile({loss:'meanSquaredError', optimizer:'adam'});

    return model;
}

// Train model client-side
async function trainTwoTower(dataset){
    const model = buildTwoTower(dataset.userIds.length, dataset.itemIds.length, 8);
    await model.fit([dataset.xs_user, dataset.xs_item], dataset.ys,{
        batchSize:64, epochs:5, verbose:0
    });
    document.getElementById("status-note").innerText += " ✅ Two-Tower model trained.";
    return model;
}

// Recommend top-N
document.getElementById("recommend-btn").onclick = async function() {
    const user_id = document.getElementById("user-select").value;
    if(!user_id){ alert("Please select a user"); return; }
    document.getElementById("recommend-note").innerText = "🔄 Computing recommendations...";

    // Prepare dataset & train
    const dataset = createDataset();
    const model = await trainTwoTower(dataset);

    const uidx = dataset.userIndex[user_id];
    const scores = [];
    dataset.itemIds.forEach((it,i)=>{
        const pred = model.predict([tf.tensor1d([uidx],'int32'), tf.tensor1d([i],'int32')]);
        const item = items.find(itm=>itm.item_id===it);
        const ratingAgg = interactions.filter(inter=>inter.item_id===it).reduce((a,b)=>a+b.rating,0);
        const score = pred.dataSync()[0] + ratingAgg/10 / (item.price||1);
        scores.push({...item, score});
    });

    // Top-N
    const topN = scores.sort((a,b)=>b.score-a.score).slice(0,10);
    const tbody = document.querySelector("#recommendation-table tbody");
    tbody.innerHTML = "";
    topN.forEach((item,idx)=>{
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

// EDA chart
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
