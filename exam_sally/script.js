document.getElementById("auto-load-btn").onclick = autoLoadData;
document.getElementById("upload-data-btn").onclick = ()=>document.getElementById("upload-box").style.display="block";

document.getElementById("upload-users").addEventListener("change", e=>handleCSVUpload(e,"users"));
document.getElementById("upload-items").addEventListener("change", e=>handleCSVUpload(e,"items"));
document.getElementById("upload-interactions").addEventListener("change", e=>handleCSVUpload(e,"interactions"));
document.getElementById("upload-embeddings").addEventListener("change", e=>handleJSONUpload(e));

function handleCSVUpload(e, type){
  const reader = new FileReader();
  reader.onload = evt=>{
    const text = evt.target.result;
    if(type==="users") parseUsers(text);
    else if(type==="items") parseItems(text);
    else parseInteractions(text);
    document.getElementById("status-note").innerText = `✅ ${type} uploaded successfully.`;
    initializeUI();
  };
  reader.readAsText(e.target.files[0]);
}

function handleJSONUpload(e){
  const reader = new FileReader();
  reader.onload = evt=>{
    itemEmbeddings = JSON.parse(evt.target.result);
    document.getElementById("embeddings-note").innerText = "✅ Embeddings JSON loaded.";
  };
  reader.readAsText(e.target.files[0]);
}

// Initialize location + item UI
function initializeUI(){
  populateLocationButtons();
  populateItemDropdown();
}

function populateLocationButtons(){
  const container=document.getElementById("location-buttons");
  container.innerHTML='<button class="location-btn" data-location="All">All Locations</button>';
  const locs=[...new Set(users.map(u=>u.location))];
  locs.forEach(loc=>{
    const btn=document.createElement("button");
    btn.className="location-btn";
    btn.dataset.location=loc;
    btn.innerText=loc;
    btn.onclick=()=>filterUsersByLocation(loc);
    container.appendChild(btn);
  });
}

function populateItemDropdown(){
  const select=document.getElementById("item-select");
  select.innerHTML='<option value="">-- Select an Item --</option>';
  items.forEach(it=>{
    const option=document.createElement("option");
    option.value=it.item_id;
    option.innerText=it.name;
    select.appendChild(option);
  });
  select.onchange=()=>displayItemHistory(select.value);
}

function filterUsersByLocation(loc){
  document.getElementById("location-note").innerText = `Filtered users by: ${loc}`;
}

function displayItemHistory(item_id){
  const tbody=document.querySelector("#history-table tbody");
  tbody.innerHTML="";
  if(!item_id) return;
  const item=items.find(it=>it.item_id===item_id);
  document.getElementById("item-name-display").innerText=item.name;

  const hist=interactions.filter(i=>i.item_id===item_id);
  hist.forEach(h=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${h.user_id}</td><td>${h.rating}</td><td>$${item.price.toFixed(2)}</td><td>${h.timestamp}</td>`;
    tbody.appendChild(tr);
  });

  updateEDA(item_id);
}

function updateEDA(item_id){
  const hist=interactions.filter(i=>i.item_id===item_id);
  const ratings=hist.map(h=>h.rating);
  const prices=ratings.map(()=>items.find(it=>it.item_id===item_id)?.price||0);
  const ctx=document.getElementById("eda-chart").getContext('2d');
  if(window.edaChart) window.edaChart.destroy();
  window.edaChart=new Chart(ctx,{
    type:'bar',
    data:{labels:ratings.map((_,i)=>`#${i+1}`),
          datasets:[{label:'Rating Distribution',data:ratings,backgroundColor:'#ff66b2'}]},
    options:{responsive:true,plugins:{title:{display:true,text:'Rating Distribution'}}}
  });
}

// Compute Recommendations
document.getElementById("recommend-btn").onclick=()=>{
  if(Object.keys(itemEmbeddings).length===0){
    alert("Please upload embeddings JSON first!");
    return;
  }
  const tbody=document.querySelector("#recommendation-table tbody");
  tbody.innerHTML="";
  const avgRatings=items.map(it=>{
    const related=interactions.filter(r=>r.item_id===it.item_id);
    const avg=related.length?related.reduce((a,b)=>a+b.rating,0)/related.length:0;
    return {...it, avgRating:avg};
  });

  const scored=avgRatings.map(it=>{
    const score=(it.avgRating*0.6)+(1/it.price*0.4);
    return {...it, score};
  }).sort((a,b)=>b.score-a.score).slice(0,10);

  scored.forEach((it,idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${idx+1}</td><td>${it.item_id}</td><td>${it.name}</td><td>${it.avgRating.toFixed(2)}</td><td>$${it.price.toFixed(2)}</td><td>${it.score.toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById("recommend-note").innerText="✅ Recommendations computed successfully.";
};
