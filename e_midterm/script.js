// script.js — main UI + recommendation logic
// relies on window._DATA populated by data.js

// short handles
const D = () => window._DATA;

// initialize UI event listeners
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('btn-load-data').addEventListener('click', async ()=>{
    const ok = await D().loadAllCleanData();
    if(!ok) { document.getElementById('note-load').innerText = 'Failed to load CSVs'; return; }
    document.getElementById('note-load').innerText = '✅ CSVs loaded';
    populateLocationButtons();
    populateUserSelect(); // default
    updateNotes('Data loaded and UI ready');
  });

  document.getElementById('btn-download-template').addEventListener('click', downloadEmbeddingsTemplate);
  document.getElementById('file-emb').addEventListener('change', handleEmbUpload);
  document.getElementById('btn-compute').addEventListener('click', onComputeClicked);
});

// ---------------- UI helpers ----------------
function updateNotes(msg){
  D().notesLog(msg);
  // also show in per-section small notes if needed
}

function populateLocationButtons(){
  const container = document.getElementById('location-buttons');
  container.innerHTML = '';
  const locs = Array.from(new Set(D().users.map(u=>u.location).filter(x=>x && x.length>0))).sort();
  const allBtn = createBtn('All', ()=>{ onLocationSelected('All'); });
  container.appendChild(allBtn);
  locs.forEach(l => container.appendChild(createBtn(l, ()=>onLocationSelected(l))));
  document.getElementById('note-location').innerText = `Loaded ${locs.length} locations`;
}

function createBtn(label, cb){
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', cb);
  return b;
}

function onLocationSelected(loc){
  const usersList = (loc==='All') ? D().users : D().users.filter(u=>u.location===loc);
  const sel = document.getElementById('user-select');
  sel.innerHTML = '<option value="">-- Select user --</option>';
  usersList.forEach(u => {
    const opt = document.createElement('option'); opt.value = u.user_id; opt.text = u.user_id;
    sel.appendChild(opt);
  });
  document.getElementById('note-location').innerText = `Showing ${usersList.length} users for "${loc}"`;
  // set onchange
  sel.onchange = ()=> onUserSelected(sel.value);
}

function populateUserSelect(){
  const sel = document.getElementById('user-select');
  sel.innerHTML = '<option value="">-- Select user --</option>';
  // show up to first 500 users to keep UI responsive; full list available via location filter
  D().users.slice(0,500).forEach(u=>{
    const opt = document.createElement('option'); opt.value = u.user_id; opt.text = u.user_id;
    sel.appendChild(opt);
  });
  sel.onchange = ()=> onUserSelected(sel.value);
  document.getElementById('note-user').innerText = 'Select a user or filter by location';
}

function onUserSelected(userId){
  if(!userId){
    document.getElementById('note-user').innerText = 'No user selected';
    clearHistory();
    updateEDA(null);
    return;
  }
  document.getElementById('note-user').innerText = `Selected user ${userId}`;
  showUserHistory(userId);
  updateEDA(userId);
}

// ---------------- History ----------------
function clearHistory(){
  document.querySelector('#history-table tbody').innerHTML = '';
  document.getElementById('note-history').innerText = '';
}

function showUserHistory(userId){
  const hist = D().interactions.filter(x=>x.user_id === userId).sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp));
  const tbody = document.querySelector('#history-table tbody');
  tbody.innerHTML = '';
  hist.forEach((h, idx)=>{
    const it = D().items.find(itm=>itm.item_id === h.item_id) || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${idx+1}</td><td>${h.item_id}</td><td>${escapeHtml(it.name||'')}</td><td>${(it.price ? Number(it.price).toFixed(2) : 'N/A')}</td><td>${h.rating}</td><td>${h.timestamp}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('note-history').innerText = `History: ${hist.length} records`;
}

// ---------------- Embeddings template / upload ----------------
function downloadEmbeddingsTemplate(){
  const dim = 16; // recommended
  const template = {};
  D().items.forEach(it=> template[it.item_id] = Array(dim).fill(0));
  const blob = new Blob([JSON.stringify(template, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'item_embeddings_template.json'; a.click();
  updateNotes('Downloaded embeddings template (zeros)');
  document.getElementById('note-emb').innerText = 'Template downloaded';
}

async function handleEmbUpload(ev){
  const f = ev.target.files && ev.target.files[0];
  if(!f) return;
  try{
    const txt = await f.text();
    const obj = JSON.parse(txt);
    // basic validation: keys should be item ids
    const keys = Object.keys(obj);
    if(keys.length === 0){ document.getElementById('note-emb').innerText = 'Uploaded JSON empty'; return; }
    // check if many zeros -> warn
    let zeroVectors = 0;
    keys.forEach(k=>{
      const v = obj[k];
      if(!Array.isArray(v) || v.length === 0) zeroVectors++;
      else {
        const sumAbs = v.reduce((s,x)=>s+Math.abs(Number(x)||0),0);
        if(sumAbs === 0) zeroVectors++;
      }
    });
    embeddings = obj; // store in data module
    D().embeddings = obj;
    if(zeroVectors === keys.length){
      document.getElementById('note-emb').innerText = 'Uploaded embeddings are all zeros (template). App will fallback to co-occurrence similarity. Consider generating real embeddings offline.';
      updateNotes('Embeddings uploaded — ALL ZERO vectors (template). Using fallback similarity.');
    } else {
      document.getElementById('note-emb').innerText = `Embeddings uploaded (${keys.length}) — ${zeroVectors} zero vectors detected`;
      updateNotes(`Embeddings uploaded (${keys.length})`);
    }
  }catch(err){
    console.error(err); document.getElementById('note-emb').innerText = 'Failed to parse JSON';
    updateNotes('Failed to parse embeddings JSON');
  }
}

// ---------------- Compute recommendations (main) ----------------
function onComputeClicked(){
  const userId = document.getElementById('user-select').value;
  if(!userId) { alert('Please select a user first'); return; }
  const topn = parseInt(document.getElementById('input-topn').value) || 10;
  const useEmb = document.getElementById('chk-use-emb').checked;
  document.getElementById('note-recs').innerText = 'Computing recommendations...';
  updateNotes(`Start compute for user ${userId} (topN=${topn}, useEmb=${useEmb})`);
  // Run compute (no recursion)
  setTimeout(()=>{ // allow UI to update
    const result = computeTopNForUser(userId, topn, useEmb);
    renderRecommendations(result);
    document.getElementById('note-recs').innerText = `Done — top${topn} computed`;
    updateNotes(`Finished compute for user ${userId}`);
  }, 20);
}

/* computeTopNForUser:
   - If embeddings present and not all-zero and useEmb=true: prefer embeddings similarity
   - else fallback to co-occurrence similarity based on itemUsersMap (Jaccard / overlap)
   - produce three lists: bestValue, highestRated, mostSimilar
*/
function computeTopNForUser(userId, topN=10, useEmb=true){
  const userHist = D().interactions.filter(x=>x.user_id === userId);
  const purchased = new Set(userHist.map(h=>h.item_id));
  const candidateItems = D().items.filter(it => !purchased.has(it.item_id));
  const dim = inferEmbeddingDim();

  // compute user embedding average if embeddings available and valid
  let userEmbAvg = null;
  if(useEmb && D().embeddings && Object.keys(D().embeddings).length>0){
    userEmbAvg = Array(dim).fill(0); let count=0;
    userHist.forEach(h=>{
      const v = D().embeddings[h.item_id];
      if(Array.isArray(v) && v.length === dim){
        for(let j=0;j<dim;j++) userEmbAvg[j] += Number(v[j])||0;
        count++;
      }
    });
    if(count>0) for(let j=0;j<dim;j++) userEmbAvg[j] /= count;
    else userEmbAvg = null;
  }

  // price & rating norms
  const maxRating = D().maxRating || 1;
  const minP = D().minPrice || 0;
  const maxP = D().maxPrice || 1;

  // compute scores
  const scored = candidateItems.map(it=>{
    // similarity
    let sim = 0;
    if(useEmb && userEmbAvg){
      const v = D().embeddings[it.item_id];
      if(Array.isArray(v) && v.length===userEmbAvg.length) sim = Math.max(0, cosine(userEmbAvg, v));
    } else {
      // fallback co-occurrence: average Jaccard between itemUsers(it) and each purchased item
      const itemUsers = D().itemUsersMap.get(it.item_id) || new Set();
      if(userHist.length > 0){
        let sumJ = 0; let cnt=0;
        userHist.forEach(h=>{
          const otherUsers = D().itemUsersMap.get(h.item_id) || new Set();
          const j = jaccard(itemUsers, otherUsers);
          sumJ += j; cnt++;
        });
        sim = cnt>0 ? (sumJ/cnt) : 0;
      } else sim = 0;
    }

    // avg rating normalized
    const avgRating = D().itemAvgRatingMap.get(it.item_id) || 0;
    const ratingNorm = avgRating / maxRating;

    // price normalized (lower price => better)
    const price = Number(it.price) || maxP;
    const priceNorm = (maxP - price) / (maxP - minP + 1e-9);

    // three scores
    const bestValueScore = 0.6 * ratingNorm + 0.4 * priceNorm;
    const highestRatedScore = ratingNorm;
    const mostSimilarScore = sim;

    return { item_id: it.item_id, name: it.name, price, avgRating, sim, bestValueScore, highestRatedScore, mostSimilarScore };
  });

  // get top lists
  const topBest = scored.slice().sort((a,b)=>b.bestValueScore - a.bestValueScore).slice(0,topN);
  const topRated = scored.slice().sort((a,b)=>b.highestRatedScore - a.highestRatedScore).slice(0,topN);
  const topSim = scored.slice().sort((a,b)=>b.mostSimilarScore - a.mostSimilarScore).slice(0,topN);

  return { topBest, topRated, topSim };
}

// ---------------- rendering ----------------
function renderRecommendations({topBest, topRated, topSim}){
  renderRecList('list-best-value', topBest, (it)=>`${escapeHtml(it.name)} — $${it.price.toFixed(2)} — r:${it.avgRating.toFixed(1)}`);
  renderRecList('list-high-rated', topRated, (it)=>`${escapeHtml(it.name)} — $${it.price.toFixed(2)} — r:${it.avgRating.toFixed(1)}`);
  renderRecList('list-most-similar', topSim, (it)=>`${escapeHtml(it.name)} — $${it.price.toFixed(2)} — sim:${it.sim.toFixed(3)}`);
}

function renderRecList(elemId, list, fmt){
  const ol = document.getElementById(elemId);
  ol.innerHTML = '';
  list.forEach((it, idx)=>{
    const li = document.createElement('li');
    li.innerHTML = `${idx+1}. ${fmt(it)}`;
    ol.appendChild(li);
  });
}

// ---------------- EDA charts ----------------
let chartPrice=null, chartRating=null;
function updateEDA(userId){
  const hist = userId ? D().interactions.filter(i=>i.user_id === userId) : [];
  const prices = hist.map(h=> {
    const it = D().items.find(x=>x.item_id === h.item_id);
    return it ? Number(it.price) : 0;
  });
  const ratings = hist.map(h=> Number(h.rating) );

  // price chart
  const ctxP = document.getElementById('chart-price').getContext('2d');
  if(chartPrice) chartPrice.destroy();
  chartPrice = new Chart(ctxP, {
    type:'bar',
    data:{ labels:prices.map((_,i)=>i+1), datasets:[{label:'Price ($)', data:prices, backgroundColor:'#ff9ccf'}]},
    options:{ plugins:{ title:{ display:true, text: userId ? `Price distribution — user ${userId}` : 'Price distribution — no user selected' } }, scales:{ x:{display:false}, y:{beginAtZero:true} } }
  });

  // rating chart
  const ctxR = document.getElementById('chart-rating').getContext('2d');
  if(chartRating) chartRating.destroy();
  chartRating = new Chart(ctxR, {
    type:'bar',
    data:{ labels:ratings.map((_,i)=>i+1), datasets:[{label:'Rating', data:ratings, backgroundColor:'#d63384'}]},
    options:{ plugins:{ title:{ display:true, text: userId ? `Rating distribution — user ${userId}` : 'Rating distribution — no user selected' } }, scales:{ x:{display:false}, y:{beginAtZero:true} } }
  });
}

// ---------------- utilities ----------------
function inferEmbeddingDim(){
  const keys = D().embeddings ? Object.keys(D().embeddings) : [];
  if(keys.length === 0) return 16;
  const first = D().embeddings[keys[0]];
  return Array.isArray(first) ? first.length : 16;
}
function cosine(a,b){
  let dot=0,na=0,nb=0; const L = Math.min(a.length,b.length);
  for(let i=0;i<L;i++){ const av=Number(a[i])||0, bv=Number(b[i])||0; dot+=av*bv; na+=av*av; nb+=bv*bv; }
  return (na===0||nb===0)?0:(dot/Math.sqrt(na*nb));
}
function jaccard(setA, setB){
  if(!setA || !setB) return 0;
  const a=Array.from(setA), b=Array.from(setB);
  if(a.length===0 && b.length===0) return 0;
  const inter = a.filter(x=> setB.has(x)).length;
  const union = new Set([...a,...b]).size;
  return union === 0 ? 0 : inter / union;
}
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

