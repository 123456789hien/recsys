let ratingChart=null, priceChart=null;

// --- Upload CSVs ---
document.getElementById("uploadUsers").addEventListener("change", e=>{
  parseCSV(e.target.files[0], data=>{
    users=data; document.getElementById("noteUsers").innerText="Users CSV loaded ✅";
    populateLocations();
  });
});

document.getElementById("uploadItems").addEventListener("change", e=>{
  parseCSV(e.target.files[0], data=>{
    items=data; document.getElementById("noteItems").innerText="Items CSV loaded ✅";
  });
});

document.getElementById("uploadInteractions").addEventListener("change", e=>{
  parseCSV(e.target.files[0], data=>{
    interactions=data; document.getElementById("noteInteractions").innerText="Interactions CSV loaded ✅";
  });
});

// --- Upload Embeddings ---
document.getElementById("uploadEmbeddings").addEventListener("change", e=>{
  const reader = new FileReader();
  reader.onload = evt=>{
    itemEmbeddings=JSON.parse(evt.target.result);
    document.getElementById("noteEmbeddings").innerText="Embeddings loaded ✅";
  };
  reader.readAsText(e.target.files[0]);
});

// --- Populate Locations ---
function populateLocations(){
  const locSelect=document.getElementById("locationSelect");
  const locs=[...new Set(users.map(u=>u.location))];
  locs.forEach(l=>{
    const option=document.createElement("option");
    option.value=l; option.innerText=l;
    locSelect.appendChild(option);
  });
}

// --- Filter Users ---
document.getElementById("locationSelect").addEventListener("change", function(){
  const loc=this.value;
  const userSelect=document.getElementById("userSelect");
  userSelect.innerHTML='<option value="">Select a User</option>';
  const filtered=loc==="all"?users:users.filter(u=>u.location===loc);
  filtered.forEach(u=>{
    const opt=document.createElement("option");
    opt.value=u.user_id; opt.innerText=u.user_id;
    userSelect.appendChild(opt);
  });
  document.getElementById("noteLocation").innerText=`Filtered ${filtered.length} users ✅`;
});

// --- Display Purchase History + EDA ---
document.getElementById("userSelect").addEventListener("change", function(){
  const userId=this.value; if(!userId) return;
  const userInteractions=interactions.filter(i=>i.user_id===userId);
  displayPurchaseHistory(userInteractions);
});

function displayPurchaseHistory(userInteractions){
  const tbody=document.querySelector("#purchaseHistoryTable tbody"); tbody.innerHTML="";
  userInteractions.forEach(i=>{
    const item=items.find(it=>it.item_id===i.item_id);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${item?.name||i.item_id}</td><td>${item?.price||""}</td><td>${i.rating}</td><td>${i.timestamp}</td>`;
    tbody.appendChild(tr);
  });
  updateEDACharts(userInteractions);
  document.getElementById("noteUser").innerText=`Displayed ${userInteractions.length} interactions ✅`;
}

// --- EDA Charts ---
function updateEDACharts(userInteractions){
  const ratings=userInteractions.map(i=>+i.rating);
  const prices=userInteractions.map(i=>{ const it=items.find(itm=>itm.item_id===i.item_id); return it?+it.price:0; });
  if(ratingChart) ratingChart.destroy();
  if(priceChart) priceChart.destroy();
  ratingChart=new Chart(document.getElementById("ratingChart"),{type:"bar",data:{labels:ratings.map((_,i)=>i+1),datasets:[{label:"Ratings Distribution",data:ratings,backgroundColor:"#ff66b2"}]},options:{responsive:true,plugins:{title:{display:true,text:"Rating Distribution"}}}});
  priceChart=new Chart(document.getElementById("priceChart"),{type:"bar",data:{labels:prices.map((_,i)=>i+1),datasets:[{label:"Price Distribution",data:prices,backgroundColor:"#ff99cc"}]},options:{responsive:true,plugins:{title:{display:true,text:"Price Distribution"}}}});
}

// --- Step 6: Top-10 Recommendations ---
document.getElementById("computeRecommendations").addEventListener("click", ()=>{
  const userId=document.getElementById("userSelect").value;
  if(!userId){ alert("Select a user first"); return; }
  document.getElementById("noteRecom").innerText="Computing recommendations... 🔄";

  if(!itemEmbeddings.user_embeddings || Object.keys(itemEmbeddings.user_embeddings).length===0){
    alert("Please upload embeddings JSON first!");
    document.getElementById("noteRecom").innerText="";
    return;
  }

  const recoms = computeTopN(userId);
  displayTopNTables(recoms);
  document.getElementById("noteRecom").innerText="✅ Top-10 recommendations displayed";
});

// --- Compute Top-N ---
function computeTopN(userId){
  const userVec = itemEmbeddings.user_embeddings[userId];
  if(!userVec) return [];

  const userHistory = interactions.filter(i=>i.user_id===userId).map(i=>i.item_id);

  let scoredItems = items.map(item=>{
    const itemVec = itemEmbeddings.item_embeddings[item.item_id];
    let sim = 0;
    if(itemVec){
      userHistory.forEach(uid=>{
        const histVec = itemEmbeddings.item_embeddings[uid];
        if(histVec) sim += cosineSimilarity(userVec, histVec);
      });
      sim = sim / (userHistory.length || 1);
    }

    const ratings = interactions.filter(i=>i.item_id===item.item_id).map(i=>+i.rating);
    const ratingAvg = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0;
    const price = +item.price || 1;

    const scoreBV = ratingAvg / price;
    const scoreHR = ratingAvg;
    const scoreMS = sim;

    return {...item, scoreBV, scoreHR, scoreMS, rating: ratingAvg};
  });

  const topBV = [...scoredItems].sort((a,b)=>b.scoreBV-a.scoreBV).slice(0,10);
  const topHR = [...scoredItems].sort((a,b)=>b.scoreHR-a.scoreHR).slice(0,10);
  const topMS = [...scoredItems].sort((a,b)=>b.scoreMS-a.scoreMS).slice(0,10);

  return {topBV, topHR, topMS};
}

// --- Display Top-N Tables ---
function displayTopNTables(recoms){
  const {topBV, topHR, topMS} = recoms;

  function renderTable(id, data, scoreKey){
    const tbody = document.querySelector(`#${id} tbody`);
    tbody.innerHTML = "";
    data.forEach((item,i)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i+1}</td>
                      <td>${item.name}</td>
                      <td>${item.rating.toFixed(2)}</td>
                      <td>${item.price}</td>
                      <td>${item[scoreKey].toFixed(2)}</td>`;
      tbody.appendChild(tr);
    });
  }

  renderTable("bestValueTable", topBV, "scoreBV");
  renderTable("highestRatedTable", topHR, "scoreHR");
  renderTable("mostSimilarTable", topMS, "scoreMS");
}

// --- Cosine similarity ---
function cosineSimilarity(a,b){
  let dot=0,normA=0,normB=0;
  for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; normA+=a[i]*a[i]; normB+=b[i]*b[i]; }
  return normA && normB ? dot/(Math.sqrt(normA)*Math.sqrt(normB)) : 0;
}
