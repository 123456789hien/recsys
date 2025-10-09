// script.js - UI interactions, recommendation logic, charts

// UI helpers
function byId(id){ return document.getElementById(id); }

// Populate location buttons (users must be loaded)
function populateLocationButtons(){
  const container = byId("location-buttons");
  container.innerHTML = `<button class="btn light" data-loc="All">All</button>`;
  const locs = [...new Set(users.map(u=>u.location).filter(x=>x && x.trim()!==""))].sort();
  locs.forEach(loc=>{
    const b = document.createElement("button");
    b.className = "btn light";
    b.innerText = loc;
    b.dataset.loc = loc;
    b.onclick = ()=> filterUsersByLocation(loc);
    container.appendChild(b);
  });
  // also hook All
  container.querySelector('[data-loc="All"]').onclick = ()=> filterUsersByLocation("All");
  byId("note-location").innerText = `Locations ready (${locs.length})`;
}

function filterUsersByLocation(loc){
  // Note: this action is mainly informational here because the user selection is item-based.
  byId("note-location").innerText = `Filter set: ${loc}`;
}

// Populate item select (items must be loaded)
function populateItemSelect(){
  const sel = byId("select-item");
  sel.innerHTML = `<option value="">-- Choose an item --</option>`;
  items.forEach(it=>{
    const opt = document.createElement("option");
    opt.value = it.item_id;
    opt.innerText = `${it.item_id} — ${it.name}`;
    sel.appendChild(opt);
  });
  sel.onchange = onItemSelected;
  byId("note-item").innerText = `${items.length} items available`;
}

// When item selected -> display purchase history of that item
function onItemSelected(){
  const itemId = byId("select-item").value;
  if(!itemId) {
    byId("history-item-name").innerText = "—";
    clearTable("item-history-table");
    return;
  }
  const itemObj = items.find(x=>x.item_id===itemId);
  byId("history-item-name").innerText = itemObj ? itemObj.name : itemId;

  // Filter interactions for this item
  const rows = interactions.filter(r=>r.item_id === itemId);
  // build table: User_ID | Rating | Price | Timestamp
  const tbody = document.querySelector("#item-history-table tbody");
  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();
  for(const r of rows){
    const tr = document.createElement("tr");
    const price = (items.find(it=>it.item_id===r.item_id)?.price) || 0;
    tr.innerHTML = `<td>${r.user_id}</td><td>${(r.rating||0).toFixed(2)}</td><td>$${price.toFixed(2)}</td><td>${r.timestamp}</td>`;
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
  byId("note-history").innerText = `Displayed ${rows.length} purchases for this item`;
  // update EDA for this item's buyers (optional)
  drawRatingPriceScatterForItem(itemId);
}

// Clear table helper
function clearTable(tableId){
  const t = document.getElementById(tableId);
  if(t) t.querySelector('tbody').innerHTML = '';
}

// Recommendation computation
byId("btn-recommend").addEventListener("click", async ()=>{
  byId("note-recom").innerText = "Computing recommendations...";

  // build auxiliary maps if not built
  if(avgRatingMap.size===0 || itemToUsers.size===0) buildAuxiliaryMaps();

  // decide weights
  const profile = byId("weight-profile").value || "balanced";
  let wSim=0.5, wRating=0.4, wPrice=0.1;
  if(profile==="rating-heavy"){ wSim=0.3; wRating=0.6; wPrice=0.1; }
  if(profile==="similarity-heavy"){ wSim=0.7; wRating=0.2; wPrice=0.1; }

  // base similarity: if embeddings available -> use item embeddings; otherwise use co-purchase Jaccard
  const useEmb = embeddings.item_embeddings && Object.keys(embeddings.item_embeddings).length>0;

  // If user asked to pick an anchor item, we can compute recommendations around it; else global (we'll use all items)
  const anchorItem = byId("select-item").value || null;

  // Precompute similarity scores (for anchor or global pairwise as needed)
  const simScores = new Map(); // item_id -> sim value
  if(anchorItem){
    // compute similarity of anchor -> every item
    if(useEmb && embeddings.item_embeddings[anchorItem]){
      const anchorVec = embeddings.item_embeddings[anchorItem];
      for(const it of items){
        const vec = embeddings.item_embeddings[it.item_id];
        if(!vec){ simScores.set(it.item_id, 0); continue; }
        simScores.set(it.item_id, cosine(anchorVec, vec));
      }
    } else {
      // use Jaccard on user sets
      const anchorUsers = itemToUsers.get(anchorItem) || new Set();
      for(const it of items){
        const otherUsers = itemToUsers.get(it.item_id) || new Set();
        const inter = intersectionSize(anchorUsers, otherUsers);
        const union = anchorUsers.size + otherUsers.size - inter;
        const j = union>0 ? inter/union : 0;
        simScores.set(it.item_id, j);
      }
    }
  } else {
    // no anchor: we can estimate item popularity similarity to "popular" set: set sim = 1 for all
    for(const it of items) simScores.set(it.item_id, 0); // neutral similarity
  }

  // compute avg rating map for each item (already in avgRatingMap)
  // compute price map
  const priceMap = new Map(items.map(it=>[it.item_id, (it.price||0) || 0.0001]));

  // Normalize similarity and rating to comparable scales [0,1]
  const simVals = Array.from(simScores.values());
  const simNorm = normalizeArray(simVals);

  // create map of normalized sim
  const simNormMap = new Map();
  let idx=0;
  for(const key of simScores.keys()){
    simNormMap.set(key, simVals.length ? simNorm[idx++] : 0);
  }

  // ratings
  const ratingArr = items.map(it=> avgRatingMap.has(it.item_id) ? avgRatingMap.get(it.item_id) : 0 );
  const ratingNormArr = normalizeArray(ratingArr);
  const ratingNormMap = new Map();
  items.forEach((it,i)=> ratingNormMap.set(it.item_id, ratingNormArr[i] || 0));

  // compute final score = (wSim*sim_norm + wRating*rating_norm) / (1 + wPrice*price_norm)
  // price_norm: normalize price inverse (we want cheaper => higher score)
  const prices = items.map(it=>priceMap.get(it.item_id));
  const maxP = Math.max(...prices,1);
  const priceNormArr = prices.map(p => p / maxP); // 0..1 (higher means more expensive)
  const invPriceArr = priceNormArr.map(p => 1 - p); // cheaper -> near 1
  const invPriceMap = new Map();
  items.forEach((it,i)=> invPriceMap.set(it.item_id, invPriceArr[i]));

  // compute score for each item
  const scored = items.map(it=>{
    const id = it.item_id;
    const s_sim = simNormMap.get(id) || 0;
    const s_rat = ratingNormMap.get(id) || 0;
    const s_price = invPriceMap.get(id) || 0;
    // combine
    const numerator = wSim * s_sim + wRating * s_rat;
    // incorporate price as factor
    const score = numerator * (1 + wPrice * s_price);
    const avgR = avgRatingMap.has(id) ? avgRatingMap.get(id) : 0;
    return { id, name: it.name, rating: avgR, price: priceMap.get(id), score };
  });

  // sort descending by score
  scored.sort((a,b)=>b.score - a.score);
  const top10 = scored.slice(0,10);

  // render table
  const tbody = document.querySelector("#recommendation-table tbody");
  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();
  top10.forEach((row,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td>
                    <td>${row.id}</td>
                    <td>${escapeHtml(row.name)}</td>
                    <td>${(row.rating||0).toFixed(2)}</td>
                    <td>$${(row.price||0).toFixed(2)}</td>
                    <td>${row.score.toFixed(4)}</td>`;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  byId("note-recom").innerText = `Top-10 computed (${anchorItem ? "around " + anchorItem : "global"})`;
  // also update EDA overall
  drawRatingPriceScatterAll();
});

// UTILITIES

function cosine(a,b){
  if(!a || !b) return 0;
  let dot=0, na=0, nb=0;
  const n = Math.min(a.length,b.length);
  for(let i=0;i<n;i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  if(na===0||nb===0) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}
function intersectionSize(s1,s2){
  if(!s1 || !s2) return 0;
  let c=0;
  // iterate smaller
  if(s1.size < s2.size){
    for(const v of s1) if(s2.has(v)) c++;
  } else {
    for(const v of s2) if(s1.has(v)) c++;
  }
  return c;
}
function normalizeArray(arr){
  if(!arr || arr.length===0) return [];
  const min = Math.min(...arr), max = Math.max(...arr);
  if(max===min) return arr.map(_=>0);
  return arr.map(v => (v - min) / (max - min));
}
function escapeHtml(s){ if(!s) return ""; return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// EDA: scatter for selected item buyers
function drawRatingPriceScatterForItem(itemId){
  const rows = interactions.filter(r => r.item_id === itemId);
  const ratings = rows.map(r=> +r.rating || 0);
  const prices = rows.map(r => {
    const it = items.find(x=>x.item_id === r.item_id);
    return it ? (it.price||0) : 0;
  });
  const ctx = document.getElementById("chart-rating-price").getContext('2d');
  if(window._edaChartAll) window._edaChartAll.destroy();
  window._edaChartAll = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: `Rating vs Price (item ${itemId})`,
        data: ratings.map((r,i)=>({x: prices[i], y: r})),
        backgroundColor: '#e60073'
      }]
    },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{ x:{title:{display:true,text:'Price ($)'}}, y:{title:{display:true,text:'Rating'}} } }
  });
  byId("note-eda").innerText = `EDA for item ${itemId} (buyers: ${rows.length})`;
}

// EDA: scatter for all items (avg rating vs price)
function drawRatingPriceScatterAll(){
  const dataPoints = items.map(it=>{
    const avg = avgRatingMap.has(it.item_id) ? avgRatingMap.get(it.item_id) : 0;
    return { x: it.price || 0, y: avg, name: it.name, id: it.item_id };
  });
  const ctx = document.getElementById("chart-rating-price").getContext('2d');
  if(window._edaChartAll) window._edaChartAll.destroy();
  window._edaChartAll = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Avg Rating vs Price (items)',
        data: dataPoints.map(p=>({x:p.x, y:p.y})),
        backgroundColor:'#ff66b2'
      }]
    },
    options:{ responsive:true, plugins:{legend:{display:false}, tooltip: { callbacks: { label: function(ctx){ const p = dataPoints[ctx.dataIndex]; return `${p.id} — ${p.name} : $${p.x} / ${p.y.toFixed(2)}` } } } }, scales:{ x:{title:{display:true,text:'Price ($)'}}, y:{title:{display:true,text:'Avg Rating'}} } }
  });
  byId("note-eda").innerText = `EDA updated: ${items.length} items`;
}

// small helper: escape final
