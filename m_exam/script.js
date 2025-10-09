// Show user purchase history
document.getElementById("userSelect").addEventListener("change", e => {
  const userId = e.target.value;
  displayPurchaseHistory(userId);
});

function displayPurchaseHistory(userId) {
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = '';
  const userInteractions = interactions.filter(i => i.user_id == userId);
  userInteractions.forEach(i => {
    const item = items.find(it => it.item_id == i.item_id);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${item.name}</td><td>${i.rating}</td><td>${item.price}</td><td>${i.timestamp}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById("noteHistory").innerText = "History displayed ✅";
  updateEDACharts(userId);
}

// EDA Charts
function updateEDACharts(userId) {
  const userInteractions = interactions.filter(i => i.user_id == userId);
  const ratings = userInteractions.map(i => i.rating);
  const prices = userInteractions.map(i => {
    const item = items.find(it => it.item_id==i.item_id);
    return item.price;
  });

  // Destroy old charts if exist
  if(window.ratingChart) window.ratingChart.destroy();
  if(window.priceChart) window.priceChart.destroy();

  const ctx1 = document.getElementById("ratingChart").getContext("2d");
  window.ratingChart = new Chart(ctx1, {
    type: 'bar',
    data: {labels: ratings, datasets:[{label:'Rating Distribution', data:ratings, backgroundColor:'#ff66b3'}]},
    options:{responsive:true,title:{display:true,text:'Rating Distribution'}}
  });

  const ctx2 = document.getElementById("priceChart").getContext("2d");
  window.priceChart = new Chart(ctx2, {
    type:'bar',
    data:{labels:prices, datasets:[{label:'Price Distribution', data:prices, backgroundColor:'#ff3399'}]},
    options:{responsive:true,title:{display:true,text:'Price Distribution'}}
  });
}

// Compute Top-10 Recommendations
document.getElementById("computeTopN").addEventListener("click", ()=>{
  const userId = document.getElementById("userSelect").value;
  if(!userId) { alert("Please select a user!"); return; }
  if(Object.keys(itemEmbeddings).length===0){ alert("Please upload embeddings JSON first!"); return; }
  computeRecommendationsForUser(userId);
});

function computeRecommendationsForUser(userId){
  const userInteractions = interactions.filter(i=>i.user_id==userId);
  const userItems = userInteractions.map(i=>i.item_id);
  const userRatings = {};
  userInteractions.forEach(i=>userRatings[i.item_id]=i.rating);

  // Compute similarity score using embeddings
  const scores = [];
  items.forEach(it=>{
    if(userItems.includes(it.item_id)) return; // skip already bought
    const emb = itemEmbeddings[it.item_id];
    if(!emb) return;
    let sim = 0;
    userItems.forEach(uid=>{
      const embUserItem = itemEmbeddings[uid];
      if(!embUserItem) return;
      // Cosine similarity
      const dot = emb.reduce((acc,v,i)=>acc+v*embUserItem[i],0);
      const norm1 = Math.sqrt(emb.reduce((acc,v)=>acc+v*v,0));
      const norm2 = Math.sqrt(embUserItem.reduce((acc,v)=>acc+v*v,0));
      sim += dot/(norm1*norm2);
    });
    sim = sim/userItems.length;
    const rating = it.rating || 0;
    const price = it.price || 1;
    const score = 0.5*sim + 0.3*rating/5 + 0.2*(1/price);
    scores.push({item:it.name,score:score,rating:rating,price:price});
  });

  // Top-10 per category
  const bestValue = [...scores].sort((a,b)=>b.score-a.score).slice(0,10);
  const highestRated = [...scores].sort((a,b)=>b.rating-b.rating).slice(0,10);
  const mostSimilar = [...scores].sort((a,b)=>b.score-a.score).slice(0,10);

  const tbody = document.querySelector("#topNTable tbody");
  tbody.innerHTML = '';
  for(let i=0;i<10;i++){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${bestValue[i]?.item || ''}</td><td>${highestRated[i]?.item || ''}</td><td>${mostSimilar[i]?.item || ''}</td>`;
    tbody.appendChild(tr);
  }
  document.getElementById("noteTopN").innerText = "Top-10 Recommendations computed ✅";
}
