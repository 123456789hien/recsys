// --- File Upload Handlers ---
document.getElementById("upload-users").addEventListener("change", e=>{
  loadCSV(e.target.files[0], data=>{
    users = data;
    document.getElementById("note-users").innerText = "✅ Users loaded";
    populateLocations();
  });
});

document.getElementById("upload-items").addEventListener("change", e=>{
  loadCSV(e.target.files[0], data=>{
    items = data;
    document.getElementById("note-items").innerText = "✅ Items loaded";
  });
});

document.getElementById("upload-interactions").addEventListener("change", e=>{
  loadCSV(e.target.files[0], data=>{
    interactions = data;
    document.getElementById("note-interactions").innerText = "✅ Interactions loaded";
  });
});

// --- Populate Locations ---
function populateLocations() {
  const locations = [...new Set(users.map(u=>u.location))];
  const container = document.getElementById("location-buttons");
  container.innerHTML = '';
  locations.forEach(loc=>{
    const btn = document.createElement("button");
    btn.innerText = loc;
    btn.onclick = ()=>filterUsersByLocation(loc);
    container.appendChild(btn);
  });
  // All button
  const allBtn = document.createElement("button");
  allBtn.innerText = "All Locations";
  allBtn.onclick = ()=>filterUsersByLocation(null);
  container.appendChild(allBtn);
}

// --- Filter Users ---
function filterUsersByLocation(location) {
  const userDropdown = document.getElementById("user-dropdown");
  userDropdown.innerHTML = "<option>Select User</option>";
  let filtered = location ? users.filter(u=>u.location===location) : users;
  filtered.forEach(u=>{
    let opt = document.createElement("option");
    opt.value = u.user_id;
    opt.innerText = u.user_id;
    userDropdown.appendChild(opt);
  });
  document.getElementById("note-filter").innerText = `✅ Filtered ${filtered.length} users`;
}

// --- Purchase History ---
document.getElementById("user-dropdown").addEventListener("change", e=>{
  const userId = e.target.value;
  displayPurchaseHistory(userId);
});

function displayPurchaseHistory(userId){
  const tbody = document.querySelector("#purchase-history tbody");
  tbody.innerHTML = '';
  if(!userId) return;
  const userInteractions = interactions.filter(i=>i.user_id===userId);
  userInteractions.forEach(i=>{
    const item = items.find(it=>it.item_id===i.item_id);
    const row = `<tr>
      <td>${item ? item.name : i.item_id}</td>
      <td>${item ? item.price : '-'}</td>
      <td>${i.rating}</td>
      <td>${i.timestamp}</td>
    </tr>`;
    tbody.innerHTML += row;
  });
  updateEDACharts(userInteractions);
}

// --- EDA Charts ---
let ratingChart = null;
let priceChart = null;
function updateEDACharts(userInteractions){
  const ratings = userInteractions.map(i=>+i.rating);
  const prices = userInteractions.map(i=>{
    const item = items.find(it=>it.item_id===i.item_id);
    return item ? +item.price : 0;
  });
  const ctxR = document.getElementById("rating-chart").getContext("2d");
  const ctxP = document.getElementById("price-chart").getContext("2d");

  if(ratingChart) ratingChart.destroy();
  ratingChart = new Chart(ctxR, {
    type: 'bar',
    data: {labels: ratings.map((r,i)=>i+1), datasets:[{label:"Rating Distribution", data:ratings, backgroundColor:"#ff66b3"}]},
    options:{plugins:{title:{display:true,text:"Rating Distribution"}}}
  });

  if(priceChart) priceChart.destroy();
  priceChart = new Chart(ctxP, {
    type: 'bar',
    data: {labels: prices.map((r,i)=>i+1), datasets:[{label:"Price Distribution", data:prices, backgroundColor:"#ff3399"}]},
    options:{plugins:{title:{display:true,text:"Price Distribution"}}}
  });
}

// --- Upload Embeddings ---
document.getElementById("upload-embeddings").addEventListener("change", e=>{
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = evt=>{
    embeddings = JSON.parse(evt.target.result);
    document.getElementById("note-embeddings").innerText = "✅ Embeddings loaded";
  };
  reader.readAsText(file);
});

// --- Compute Top-N Recommendations ---
document.getElementById("compute-topn").addEventListener("click", ()=>{
  const userId = document.getElementById("user-dropdown").value;
  if(!userId) return alert("Select a user first");
  if(!embeddings) return alert("Upload embeddings JSON first");
  computeRecommendationsForUser(userId);
  document.getElementById("note-topn").innerText = "✅ Recommendations computed";
});

function cosineSim(vecA, vecB){
  const dot = vecA.reduce((acc,v,i)=>acc+v*vecB[i],0);
  const normA = Math.sqrt(vecA.reduce((acc,v)=>acc+v*v,0));
  const normB = Math.sqrt(vecB.reduce((acc,v)=>acc+v*v,0));
  return dot/(normA*normB);
}

function computeRecommendationsForUser(userId){
  const userVec = embeddings.user_embeddings[userId];
  if(!userVec) return alert("No embedding for this user");

  const scores = items.map(it=>{
    const itemVec = embeddings.item_embeddings[it.item_id];
    const sim = itemVec ? cosineSim(userVec,itemVec) : 0;
    const rating = interactions.filter(i=>i.user_id===userId && i.item_id===it.item_id).map(i=>+i.rating)[0] || 0;
    const price = +it.price || 0;
    // Smart weighting: example
    const scoreBV = rating/price || 0;
    const scoreHR = rating;
    const scoreMS = sim;
    return {...it, scoreBV, scoreHR, scoreMS};
  });

  function renderTable(id, sortKey){
    const tbody = document.querySelector(`#${id} tbody`);
    tbody.innerHTML = '';
    const top10 = [...scores].sort((a,b)=>b[sortKey]-a[sortKey]).slice(0,10);
    top10.forEach((it,i)=>{
      tbody.innerHTML += `<tr>
        <td>${i+1}</td><td>${it.name}</td><td>${it.rating}</td><td>${it.price}</td><td>${it[sortKey].toFixed(2)}</td>
      </tr>`;
    });
  }

  renderTable("best-value","scoreBV");
  renderTable("highest-rated","scoreHR");
  renderTable("most-similar","scoreMS");
}
