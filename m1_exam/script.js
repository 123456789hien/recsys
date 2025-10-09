let ratingChart, priceChart;

// --- Step 1: Upload CSV ---
document.getElementById("uploadUsers").addEventListener("change", e=>{
  readCSV(e.target.files[0], data => {
    users = data;
    document.getElementById("noteStep1").innerText = "✅ Users loaded: " + users.length;
    populateLocations();
  });
});
document.getElementById("uploadItems").addEventListener("change", e=>{
  readCSV(e.target.files[0], data => {
    items = data;
    document.getElementById("noteStep1").innerText += " | Items loaded: " + items.length;
  });
});
document.getElementById("uploadInteractions").addEventListener("change", e=>{
  readCSV(e.target.files[0], data => {
    interactions = data;
    document.getElementById("noteStep1").innerText += " | Interactions loaded: " + interactions.length;
  });
});

// --- Step 2: Filter Users ---
function populateLocations() {
  const locSet = Array.from(new Set(users.map(u=>u.location)));
  const locSelect = document.getElementById("locationFilter");
  locSet.forEach(l=>{
    const opt = document.createElement("option");
    opt.value = l; opt.text = l;
    locSelect.add(opt);
  });
}
document.getElementById("locationFilter").addEventListener("change", e=>{
  const loc = e.target.value;
  const filtered = loc ? users.filter(u=>u.location===loc) : users;
  const userSelect = document.getElementById("userFilter");
  userSelect.innerHTML = '<option value="">Select User</option>';
  filtered.forEach(u=>{
    const opt = document.createElement("option");
    opt.value = u.user_id; opt.text = u.user_id;
    userSelect.add(opt);
  });
  document.getElementById("noteStep2").innerText = `✅ Users filtered: ${filtered.length}`;
});

// --- Step 3: User Purchase History ---
document.getElementById("userFilter").addEventListener("change", e=>{
  const uid = e.target.value;
  const tbody = document.querySelector("#purchaseHistoryTable tbody");
  tbody.innerHTML = "";
  if(!uid) return;
  const userInter = interactions.filter(r=>r.user_id===uid);
  userInter.forEach(r=>{
    const item = items.find(i=>i.item_id===r.item_id);
    if(!item) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${item.name}</td><td>${item.price}</td><td>${r.rating}</td><td>${r.timestamp}</td>`;
    tbody.appendChild(tr);
  });
  updateEDACharts(userInter);
  document.getElementById("noteStep3").innerText = `✅ Purchase history displayed: ${userInter.length} items`;
});

// --- Step 4: EDA Charts ---
function updateEDACharts(userInter){
  const ratings = userInter.map(r=>+r.rating);
  const prices = userInter.map(r=>{
    const item = items.find(i=>i.item_id===r.item_id);
    return item ? +item.price : 0;
  });
  if(ratingChart) ratingChart.destroy();
  if(priceChart) priceChart.destroy();
  const ctx1 = document.getElementById("ratingChart").getContext("2d");
  ratingChart = new Chart(ctx1,{type:"bar",data:{labels:ratings.map((v,i)=>i+1),datasets:[{label:"Rating Distribution",data:ratings,backgroundColor:"#d63384"}]}});
  const ctx2 = document.getElementById("priceChart").getContext("2d");
  priceChart = new Chart(ctx2,{type:"bar",data:{labels:prices.map((v,i)=>i+1),datasets:[{label:"Price Distribution",data:prices,backgroundColor:"#d63384"}]}});
  document.getElementById("noteStep4").innerText = "✅ EDA charts updated";
}

// --- Step 5: Upload Embeddings JSON ---
document.getElementById("uploadEmbeddings").addEventListener("change", e=>{
  const reader = new FileReader();
  reader.onload = evt => {
    embeddings = JSON.parse(evt.target.result);
    document.getElementById("noteStep5").innerText = `✅ Embeddings loaded for ${Object.keys(embeddings.user_embeddings).length} users`;
  };
  reader.readAsText(e.target.files[0]);
});

// --- Step 6: Top-10 Recommendations ---
document.getElementById("computeRec").addEventListener("click", ()=>{
  const uid = document.getElementById("userFilter").value;
  if(!uid){ alert("Select a user first"); return; }
  if(!embeddings.user_embeddings){ alert("Upload embeddings JSON first"); return; }

  const userVec = embeddings.user_embeddings[uid];
  if(!userVec){ alert("No embedding for this user"); return; }

  // Compute similarity + score
  const recs = items.map(item=>{
    const itemVec = embeddings.item_embeddings[item.item_id];
    const rating = interactions.filter(r=>r.user_id===uid && r.item_id===item.item_id).map(r=>+r.rating)[0]||0;
    const price = +item.price;
    let similarity = itemVec && userVec ? cosineSim(userVec,itemVec) : 0;
    let scoreBV = rating/price || 0;
    let scoreHR = rating || 0;
    let scoreSim = similarity || 0;
    return {...item, scoreBV, scoreHR, scoreSim, rating};
  });

  // Sort top 10
  populateRecTable("bestValueTable", recs.sort((a,b)=>b.scoreBV-b.scoreBV).slice(0,10),"scoreBV");
  populateRecTable("highestRatedTable", recs.sort((a,b)=>b.scoreHR-b.scoreHR).slice(0,10),"scoreHR");
  populateRecTable("mostSimilarTable", recs.sort((a,b)=>b.scoreSim-b.scoreSim).slice(0,10),"scoreSim");
  document.getElementById("noteStep6").innerText="✅ Top-10 Recommendations computed";
});

function populateRecTable(tableId, recs,key){
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML="";
  recs.forEach((r,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${i+1}</td><td>${r.name}</td><td>${r.rating}</td><td>${r.price}</td><td>${r[key].toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
}

// --- Utils ---
function cosineSim(a,b){
  const dot = a.reduce((sum,v,i)=>sum+v*b[i],0);
  const magA = Math.sqrt(a.reduce((sum,v)=>sum+v*v,0));
  const magB = Math.sqrt(b.reduce((sum,v)=>sum+v*v,0));
  return dot/(magA*magB+1e-10);
}
