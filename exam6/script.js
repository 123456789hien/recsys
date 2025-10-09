let notesList = document.getElementById("note-list");
let ratingChart=null, priceChart=null;

function addNote(msg){
    const li = document.createElement("li");
    li.innerText=msg;
    notesList.appendChild(li);
}

function clearNotes(){
    notesList.innerHTML="";
}

// Populate user dropdown
function populateDropdowns(){
    const userSelect = document.getElementById("userSelect");
    userSelect.innerHTML="";
    filteredUsers.forEach(u=>{
        const option = document.createElement("option");
        option.value=u.user_id;
        option.innerText=u.user_id; // chỉ hiện user_id
        userSelect.appendChild(option);
    });
}

// Filter by location
function filterUsersByLocation(){
    const loc = document.getElementById("locationFilter").value;
    filteredUsers = loc==="all"? [...users] : users.filter(u=>u.location===loc);
    populateDropdowns();
    addNote(`Filtered users by location: ${loc}`);
}

// Display user purchase history
function displayUserHistory(user_id){
    const tbody = document.querySelector("#history-table tbody");
    tbody.innerHTML="";
    const userInteractions = interactions.filter(i=>i.user_id===user_id);
    if(userInteractions.length===0){
        addNote(`No interactions found for user ${user_id}`);
        return;
    }
    userInteractions.forEach(i=>{
        const item = items.find(it=>it.item_id===i.item_id);
        if(item){
            const tr = document.createElement("tr");
            tr.innerHTML=`<td>${item.name}</td><td>${i.event_type}</td><td>${item.price}</td><td>${i.rating}</td><td>${i.timestamp}</td>`;
            tbody.appendChild(tr);
        }
    });
    addNote(`Displayed history for user ${user_id}`);
    updateEDA(user_id);
}

// EDA charts
function updateEDA(user_id){
    const userRatings = interactions.filter(i=>i.user_id===user_id).map(i=>i.rating).filter(r=>r!=null);
    const ratingCounts={};
    userRatings.forEach(r=>{ ratingCounts[r] = (ratingCounts[r]||0)+1; });

    const ratingCtx = document.getElementById("ratingChart").getContext("2d");
    if(ratingChart) ratingChart.destroy();
    ratingChart = new Chart(ratingCtx,{
        type:'bar',
        data:{labels:Object.keys(ratingCounts),datasets:[{label:'Number of Ratings',data:Object.values(ratingCounts),backgroundColor:'#ff69b4'}]}
    });

    const userPrices = interactions.filter(i=>i.user_id===user_id).map(i=>items.find(it=>it.item_id===i.item_id)?.price).filter(p=>p!=null);
    const bins = Array(10).fill(0);
    const maxPrice = Math.max(...userPrices,1);
    const binSize = maxPrice/10;
    userPrices.forEach(p=>{
        const idx = Math.min(Math.floor(p/binSize),9);
        bins[idx]++;
    });

    const priceCtx = document.getElementById("priceChart").getContext("2d");
    if(priceChart) priceChart.destroy();
    priceChart = new Chart(priceCtx,{
        type:'bar',
        data:{labels:bins.map((_,i)=>`${(i*binSize).toFixed(1)}-${((i+1)*binSize).toFixed(1)}`),datasets:[{label:'Number of Items',data:bins,backgroundColor:'#ff1493'}]}
    });
}

// Collaborative Filtering + Two-Tower lightweight
async function getRecommendations(){
    const user_id = document.getElementById("userSelect").value;
    if(!user_id) return;
    addNote(`Calculating recommendations for user ${user_id}...`);

    const userRatings = userItemMap[user_id];
    if(!userRatings || Object.keys(userRatings).length===0) return addNote("No ratings found for this user.");

    // Collaborative filtering
    const scores = {};
    Object.keys(userItemMap).forEach(other_id=>{
        if(other_id===user_id) return;
        const otherRatings = userItemMap[other_id];
        let commonItems = Object.keys(userRatings).filter(k=>otherRatings[k]);
        if(commonItems.length===0) return;
        let dot=0, normA=0, normB=0;
        commonItems.forEach(it=>{
            const a = userRatings[it], b = otherRatings[it];
            dot+=a*b; normA+=a*a; normB+=b*b;
        });
        scores[other_id]=dot/(Math.sqrt(normA)*Math.sqrt(normB));
    });

    // Predict rating scores
    const pred = {};
    items.forEach(item=>{
        if(userRatings[item.item_id]) return;
        let weightedSum=0, simSum=0;
        Object.keys(scores).forEach(other_id=>{
            const r = userItemMap[other_id][item.item_id];
            if(r){ weightedSum+=scores[other_id]*r; simSum+=scores[other_id]; }
        });
        if(simSum>0) pred[item.item_id]=weightedSum/simSum;
    });

    // Two-Tower lightweight embedding (user x item)
    const embDim=8;
    const userIds = Object.keys(userItemMap);
    const userEmb = tf.variable(tf.randomNormal([userIds.length,embDim]));
    const itemEmb = tf.variable(tf.randomNormal([items.length,embDim]));
    const userIdx = userIds.indexOf(user_id);
    Object.keys(pred).forEach(item_id=>{
        const itemIdx = items.findIndex(it=>it.item_id===item_id);
        const uE = userEmb.slice([userIdx,0],[1,embDim]);
        const iE = itemEmb.slice([itemIdx,0],[1,embDim]);
        const score = tf.matMul(uE,iE,true,false).dataSync()[0];
        pred[item_id] = pred[item_id]*0.7 + score*0.3;
    });

    // Combine with price weighting
    const predItems = Object.keys(pred).map(item_id=>{
        const item = items.find(it=>it.item_id===item_id);
        const priceScore = item ? 1/(1+item.price) : 0;
        const finalScore = pred[item_id]*0.7 + priceScore*0.3;
        return {...item, score: finalScore};
    });

    predItems.sort((a,b)=>b.score-a.score);
    const topN = predItems.slice(0,10);

    const tbody = document.querySelector("#rec-table tbody");
    tbody.innerHTML="";
    topN.forEach(i=>{
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${i.name}</td><td>${i.price}</td><td>${i.score.toFixed(2)}</td>`;
        tbody.appendChild(tr);
    });

    addNote(`Top-${topN.length} recommendations displayed for user ${user_id}`);
    updateEDA(user_id);
}

// Init
window.onload=async()=>{
    clearNotes();
    addNote("Initializing application...");
    await loadData();
    populateDropdowns();
    addNote("Application ready. Select a user and click 'Get Top-N Recommendations'.");
};
