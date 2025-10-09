// script.js
// Main UI logic and recommendation functions

// Ensure data loaded, then init UI
window.addEventListener('DOMContentLoaded', async ()=>{
  const ok = await loadAllData();
  if(!ok) {
    alert('Failed to load CSV data. Check console and that data/processed/*.csv exist.');
    return;
  }
  initUI();
});

function initUI(){
  initLocationButtons();
  initUserSelect(); // initial empty
  initEmbeddingsButtons();
  initComputeButton();
  addLog('UI ready');
}

/* -------------------------
   Location buttons & user select
   ------------------------- */
function initLocationButtons(){
  const container = document.getElementById('location-buttons');
  container.innerHTML = '';
  const locSet = new Set(users.map(u=>u.location).filter(x=>x && x.length>0));
  const allBtn = makeButton('All', ()=>selectLocation('All'));
  container.appendChild(allBtn);
  Array.from(locSet).sort().forEach(loc=>{
    container.appendChild(makeButton(loc, ()=>selectLocation(loc)));
  });
  document.getElementById('location-note').innerText = '✅ Locations ready';
}

function makeButton(text, onClick){
  const b = document.createElement('button');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function selectLocation(loc){
  const filtered = loc === 'All' ? users : users.filter(u=>u.location === loc);
  const sel = document.getElementById('user-select');
  sel.innerHTML = '<option value="">-- Select User ID --</option>';
  filtered.forEach(u=>{
    const opt = document.createElement('option');
    opt.value = u.user_id;
    opt.textContent = u.user_id;
    sel.appendChild(opt);
  });
  document.getElementById('location-note').innerText = `✅ Showing ${filtered.length} users for "${loc}"`;
  // attach change handler
  sel.onchange = ()=>{ userSelected(sel.value); };
}

/* -------------------------
   User selection & history
   ------------------------- */
function initUserSelect(){
  const sel = document.getElementById('user-select');
  sel.innerHTML = '<option value="">-- Select User ID --</option>';
  // default: show all users
  users.slice(0,500).forEach(u=>{ // limit rendering long lists for perf; full list will still be selectable via location filter
    const opt = document.createElement('option');
    opt.value = u.user_id;
    opt.textContent = u.user_id;
    sel.appendChild(opt);
  });
  sel.onchange = ()=>{ userSelected(sel.value); };
  document.getElementById('user-note').innerText = 'Select a user to view history';
}

function userSelected(userId){
  if(!userId){
    document.getElementById('user-note').innerText = 'No user selected';
    clearHistoryTable();
    updateEDACharts(null);
    return;
  }
  document.getElementById('user-note').innerText = `✅ Selected user ${userId}`;
  populateHistoryTable(userId);
  updateEDACharts(userId);
}

function clearHistoryTable(){
  document.querySelector('#history-table tbody').innerHTML = '';
}

function populateHistoryTable(userId){
  const hist = interactions.filter(i=>i.user_id === userId)
                           .sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp));
  const tbody = document.querySelector('#history-table tbody');
  tbody.innerHTML = '';
  hist.forEach((row, idx)=>{
    const it = items.find(x=>x.item_id === row.item_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${idx+1}</td>
                    <td>${row.item_id}</td>
                    <td>${it ? escapeHtml(it.name) : '—'}</td>
                    <td>${it ? parseFloat(it.price).toFixed(2) : 'N/A'}</td>
                    <td>${row.rating}</td>
                    <td>${row.timestamp}</td>`;
    tbody.appendChild(tr);
  });
  addLog(`Displayed history for user ${userId} (${hist.length} records)`);
}

/* -------------------------
   Embeddings upload/download
   ------------------------- */
function initEmbeddingsButtons(){
  document.getElementById('download-template').addEventListener('click', ()=>{
    // build template with item ids mapped to zeros
    const template = {};
    const dim = 16; // recommended
    items.forEach(it => template[it.item_id] = Array(dim).fill(0));
    const blob = new Blob([JSON.stringify(template, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'item_embeddings_template.json'; a.click();
    document.getElementById('embedding-note').innerText = '✅ Template downloaded';
    addLog('Embeddings template downloaded');
  });

  document.getElementById('upload-embeddings').addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    try{
      const txt = await f.text();
      const json = JSON.parse(txt);
      // basic validation: keys should match item ids (or at least many)
      const sampleKey = Object.keys(json)[0];
      if(!sampleKey){
        document.getElementById('embedding-note').innerText = '❌ Invalid JSON (empty)';
        return;
      }
      embeddings = json;
      document.getElementById('embedding-note').innerText = `✅ Embeddings loaded (${Object.keys(embeddings).length} entries)`;
      addLog(`Embeddings uploaded — ${Object.keys(embeddings).length} vectors`);
    }catch(err){
      console.error(err);
      document.getElementById('embedding-note').innerText = '❌ Failed to parse JSON';
      addLog('Failed to parse embeddings JSON');
    }
  });
}

/* -------------------------
   Compute Top-N (main)
   ------------------------- */
function initComputeButton(){
  document.getElementById('compute-btn').addEventListener('click', ()=>{
    const userId = document.getElementById('user-select').value;
    computeRecommendationsForUser(userId, 10);
  });
}

function computeRecommendationsForUser(userId, topK=10){
  if(!userId){ alert('Please select a user first'); return; }
  // require embeddings
  if(!embeddings || Object.keys(embeddings).length === 0){
    alert('Please upload precomputed item embeddings JSON before running similarity-based recommendations.');
    return;
  }
  document.getElementById('recs-note').innerText = '🔄 Computing recommendations...';
  addLog(`Computing recommendations for user ${userId}...`);

  // 1) user history and vector (average of purchased item embeddings)
  const userHist = interactions.filter(i=>i.user_id === userId);
  const purchasedIds = userHist.map(h=>h.item_id);
  const dim = inferEmbeddingDim();
  let userVec = Array(dim).fill(0);
  if(userHist.length > 0){
    let count = 0;
    userHist.forEach(h=>{
      const v = embeddings[h.item_id];
      if(Array.isArray(v) && v.length === dim){
        for(let j=0;j<dim;j++) userVec[j] += Number(v[j]) || 0;
        count++;
      }
    });
    if(count > 0){
      for(let j=0;j<dim;j++) userVec[j] /= count;
    } else {
      // fallback small random noise to avoid zero vector
      for(let j=0;j<dim;j++) userVec[j] = Math.random()*1e-3;
    }
  } else {
    // cold user: small random vector to diversify results
    for(let j=0;j<dim;j++) userVec[j] = (Math.random()-0.5)*1e-3;
  }

  // 2) Precompute rating & price stats for normalization
  const maxRating = Math.max(1, ...interactions.map(x=>Number(x.rating)||0));
  const prices = items.map(it=>Number(it.price)||0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices) || 1;

  // 3) Build candidate list (exclude purchased)
  const candidates = items.filter(it => !purchasedIds.includes(it.item_id));

  // 4) Score candidates — compute three separate scores
  const scored = candidates.map(it=>{
    // similarity: cosine between userVec and item embedding
    const itemVec = embeddings[it.item_id] || Array(dim).fill(0);
    const simRaw = cosine(userVec, itemVec); // [-1..1] (but likely 0..1 for positive embeddings)
    const sim = Math.max(0, simRaw); // clamp negative to 0

    // rating: mean rating for item
    const itemRatings = interactions.filter(x=>x.item_id === it.item_id).map(x=>Number(x.rating)||0);
    const avgRating = itemRatings.length ? (itemRatings.reduce((a,b)=>a+b,0)/itemRatings.length) : 0;
    const ratingNorm = avgRating / maxRating; // 0..1

    // price inverse normalized (lower price => higher value)
    const price = Number(it.price) || maxPrice;
    const priceNorm = (maxPrice - price) / (maxPrice - minPrice + 1e-9); // 0..1

    // Compose per-criterion scores (weights chosen to balance signals)
    const bestValueScore = 0.6 * ratingNorm + 0.4 * priceNorm;      // rating-heavy + cheaper
    const highestRatedScore = ratingNorm;                          // pure rating
    const mostSimilarScore = sim;                                  // pure similarity

    return {
      item_id: it.item_id,
      name: it.name,
      price,
      avgRating,
      sim,
      bestValueScore,
      highestRatedScore,
      mostSimilarScore
    };
  });

  // 5) Sort and pick topK for each
  const topBest = [...scored].sort((a,b)=>b.bestValueScore - a.bestValueScore).slice(0, topK);
  const topRated = [...scored].sort((a,b)=>b.highestRatedScore - a.highestRatedScore).slice(0, topK);
  const topSimilar = [...scored].sort((a,b)=>b.mostSimilarScore - a.mostSimilarScore).slice(0, topK);

  // 6) render
  renderRecList('best-value-list', topBest, (x)=>`<strong>${escapeHtml(x.name)}</strong> — $${x.price.toFixed(2)} — r:${x.avgRating.toFixed(1)}`);
  renderRecList('highest-rated-list', topRated, (x)=>`<strong>${escapeHtml(x.name)}</strong> — $${x.price.toFixed(2)} — r:${x.avgRating.toFixed(1)}`);
  renderRecList('most-similar-list', topSimilar, (x)=>`<strong>${escapeHtml(x.name)}</strong> — $${x.price.toFixed(2)} — sim:${x.sim.toFixed(3)}`);

  document.getElementById('recs-note').innerText = `✅ Recommendations ready (BestValue=${topBest.length}, HighestRated=${topRated.length}, MostSimilar=${topSimilar.length})`;
  addLog(`Computed Top-${topK} lists for user ${userId}`);
}

/* -------------------------
   Helpers
   ------------------------- */

function inferEmbeddingDim(){
  const keys = Object.keys(embeddings);
  if(keys.length === 0) return 16;
  const first = embeddings[keys[0]];
  return Array.isArray(first) ? first.length : 16;
}

function cosine(a,b){
  if(!Array.isArray(a) || !Array.isArray(b)) return 0;
  let dot=0, nA=0, nB=0;
  const L = Math.min(a.length, b.length);
  for(let i=0;i<L;i++){
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    nA += av * av;
    nB += bv * bv;
  }
  if(nA===0 || nB===0) return 0;
  return dot / Math.sqrt(nA * nB);
}

function renderRecList(elemId, list, formatFn){
  const ol = document.getElementById(elemId);
  ol.innerHTML = '';
  list.forEach((it, idx)=>{
    const li = document.createElement('li');
    li.innerHTML = `${idx+1}. ${formatFn(it)}`;
    ol.appendChild(li);
  });
}

/* -------------------------
   EDA charts (price & rating) — dynamic titles
   ------------------------- */

let priceChart = null, ratingChart = null;

function updateEDACharts(userId){
  const hist = userId ? interactions.filter(i=>i.user_id === userId) : [];
  const prices = hist.map(h=>{
    const it = items.find(x=>x.item_id === h.item_id);
    return it ? Number(it.price) || 0 : 0;
  });
  const ratings = hist.map(h=>Number(h.rating) || 0);

  // Price chart
  const priceCtx = document.getElementById('price-chart').getContext('2d');
  if(priceChart) priceChart.destroy();
  priceChart = new Chart(priceCtx, {
    type:'bar',
    data:{
      labels: prices.map((_,i)=>i+1),
      datasets:[{label:'Price ($)', data: prices, backgroundColor:'#f8a1c7'}]
    },
    options:{
      plugins:{
        legend:{display:false},
        title:{display:true, text: userId ? `Price distribution — user ${userId}` : 'Price distribution — no user selected'}
      },
      scales:{ x:{display:false}, y:{beginAtZero:true} }
    }
  });

  // Rating chart
  const ratingCtx = document.getElementById('rating-chart').getContext('2d');
  if(ratingChart) ratingChart.destroy();
  ratingChart = new Chart(ratingCtx, {
    type:'bar',
    data:{
      labels: ratings.map((_,i)=>i+1),
      datasets:[{label:'Rating', data: ratings, backgroundColor:'#d63384'}]
    },
    options:{
      plugins:{
        legend:{display:false},
        title:{display:true, text: userId ? `Rating distribution — user ${userId}` : 'Rating distribution — no user selected'}
      },
      scales:{ x:{display:false}, y:{beginAtZero:true} }
    }
  });

  addLog(`Updated EDA charts for user ${userId || 'none'}`);
}

/* -------------------------
   Utility: escape HTML for names
   ------------------------- */
function escapeHtml(str){
  if(!str) return '';
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

/* -------------------------
   Small wrapper for push logs to main notes-log too
   ------------------------- */
function addLog(msg){
  const log = document.getElementById('notes-log');
  if(!log) return;
  const p = document.createElement('div');
  p.textContent = `${new Date().toLocaleTimeString()} — ${msg}`;
  log.prepend(p);
}
