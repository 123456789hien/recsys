let ratingChart = null, priceChart = null;

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
    embeddings = JSON.parse(evt.target.result);
    document.getElementById("noteEmbeddings").innerText="Embeddings loaded ✅";
  };
  reader.readAsText(e.target.files[0]);
});

// --- Populate Locations ---
function populateLocations(){
  const locSelect=document.getElementById("locationSelect");
  locSelect.innerHTML='<option value="all">All Locations</option>';
  const locs=[...new Set(users.map(u=>u.location))].sort();
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
  const fragment=document.createDocumentFragment();
  userInteractions.forEach(i=>{
    const item=items.find(it=>it.item_id===i.item_id);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${item?.name||i.item_id}</td><td>${item?.price||""}</td><td>${i.rating}</td><td>${i.timestamp}</td>`;
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
  updateEDACharts(userInteractions);
  document.getElementById("noteUser").innerText=`Displayed ${userInteractions.length} interactions ✅`;
}

// --- EDA Charts ---
function updateEDACharts(userInteractions){
  const ratings=userInteractions.map(i=>+i.rating);
  const prices=userInteractions.map(i=>{ const it=items.find(itm=>itm.item_id===i.item_id); return it?+it.price:0; });

  if(ratingChart) ratingChart.destroy();
  if(priceChart) priceChart.destroy();

  ratingChart=new Chart(document.getElementById("ratingChart"),{
    type:"bar",
    data:{labels:ratings.map((_,i)=>i+1),datasets:[{label:"Ratings Distribution",data:ratings,backgroundColor:"#ff66b2"}]},
    options:{responsive:true, plugins:{title:{display:true,text:"Rating Distribution"}}}
  });

  priceChart=new Chart(document.getElementById("priceChart"),{
    type:"bar",
    data:{labels:prices.map((_,i)=>i+1),datasets:[{label:"Price Distribution",data:prices,backgroundColor:"#ff99cc"}]},
    options:{responsive:true, plugins:{title:{display:true,text:"Price Distribution"}}}
  });
}

// --- Compute Top-N Recommendations ---
document.getElementById("computeRecommendations").addEventListener("click", ()=>{
  const userId=document.getElementById("userSelect").value;
  if(!userId){ alert("Select a user first"); return; }
  if(!embeddings.user_embeddings || !embeddings.item_embeddings){ alert("Upload embeddings JSON first"); return; }
  document.getElementById("noteRecom").innerText="Computing recommendations... 🔄";

  const topN=computeTopN(userId);
  displayTopN(topN);
  document.getElementById("noteRecom").innerText="Top-10 recommendations displayed ✅";
});

function computeTopN(userId){
  const userVec = embeddings.user_embeddings[userId];
  if(!userVec) return [];

  // Compute scores for each item
  return items.map(item=>{
    const itemVec = embeddings.item_embeddings[item.item_id];
    if(!itemVec) return null;

    const sim = cosineSimilarity(userVec, itemVec);
    const rating = interactions.filter(i=>i.item_id===item.item_id).reduce((sum,b)=>sum+ +b.rating,0);
    const price = +item.price || 1;
    const score = sim*0.5 + rating*0.3 + (1/price)*0.2;
    return {...item,score};
  }).filter(x=>x!==null).sort((a,b)=>b.score-a.score).slice(0,10);
}

function displayTopN(topItems){
  const tables=["bestValueTable","highestRatedTable","mostSimilarTable"];
  tables.forEach(tblId=>{
    const tbody=document.querySelector(`#${tblId} tbody`);
    tbody.innerHTML="";
    const frag=document.createDocumentFragment();
    topItems.forEach((item,i)=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${i+1}</td><td>${item.name}</td><td>${item.rating}</td><td>${item.price}</td><td>${item.score.toFixed(2)}</td>`;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  });
}

// --- Cosine Similarity ---
function cosineSimilarity(a,b){
  let dot=0, normA=0, normB=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i]; normA+=a[i]*a[i]; normB+=b[i]*b[i];}
  return normA && normB ? dot/(Math.sqrt(normA)*Math.sqrt(normB)) : 0;
}

// --- Auto-load from GitHub if no upload ---
window.addEventListener("load", ()=>{
  const base = "./data/processed/";
  ["users_clean.csv","items_clean.csv","interactions_clean.csv"].forEach(file=>{
    fetch(base+file).then(r=>r.text()).then(txt=>Papa.parse(txt,{header:true,skipEmptyLines:true,complete:res=>{
      if(file.includes("users")){ users=res.data; populateLocations(); document.getElementById("noteUsers").innerText="Users loaded from GitHub ✅"; }
      if(file.includes("items")){ items=res.data; document.getElementById("noteItems").innerText="Items loaded from GitHub ✅"; }
      if(file.includes("interactions")){ interactions=res.data; document.getElementById("noteInteractions").innerText="Interactions loaded from GitHub ✅"; }
    }})).catch(e=>console.log("Could not load",file));
  });
  fetch(base+"item_embeddings.json").then(r=>r.json()).then(j=>{ embeddings=j; document.getElementById("noteEmbeddings").innerText="Embeddings loaded from GitHub ✅"; }).catch(e=>console.log("No embeddings yet"));
});
