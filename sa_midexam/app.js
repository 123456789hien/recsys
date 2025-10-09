/* app.js
   Smart Fashion Recommender — all logic inside RecSysApp namespace
   Features: upload/auto-load, parsing, EDA, content-based, MF (tfjs), Two-Tower (tfjs), top-N
*/
const RecSysApp = (function () {
  // internal state
  const state = {
    users: [], items: [], interactions: [],
    itemEmbeddings: null, userEmbeddings: null,
    avgRating: new Map(),
    itemToUsers: new Map(),
    userToItems: new Map(),
    MF: { trained: false },
    TT: { trained: false }
  };

  // Candidate base paths for auto-load (tries multiple to avoid 404)
  const BASES = ["data/processed/", "data/", "./data/processed/", "./data/"];

  // ---------- UTIL ----------
  const $ = id => document.getElementById(id);
  const mean = arr => arr && arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const uniq = arr => Array.from(new Set(arr.filter(Boolean)));
  const safeSplit = line => line.split(/;|,|\t/).map(s=>s.trim());
  const formatMoney = v => '$' + (Number(v||0).toFixed(2));
  const escapeHtml = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');

  // ---------- CSV fetch helpers ----------
  async function tryFetchText(filename){
    for(const b of BASES){
      try{
        const path = b + filename;
        const r = await fetch(path);
        if(r.ok) return { text: await r.text(), path };
      }catch(e){}
    }
    return null;
  }

  // ---------- PARSERS ----------
  function parseUsersCSV(text){
    const lines = text.split(/\r?\n/).filter(l=>l.trim());
    let start = 0;
    if(lines[0] && /user|customer/i.test(lines[0])) start = 1;
    state.users = lines.slice(start).map(l=>{
      const cols = safeSplit(l);
      return { user_id: String(cols[0]||''), location: cols[1] || '' };
    }).filter(u=>u.user_id);
  }
  function parseItemsCSV(text){
    const lines = text.split(/\r?\n/).filter(l=>l.trim());
    let start = 0;
    if(lines[0] && /(item|stockcode|id)/i.test(lines[0])) start = 1;
    state.items = lines.slice(start).map(l=>{
      const cols = safeSplit(l);
      const id = String(cols[0]||'');
      const name = cols[1] || '';
      const price = parseFloat(cols[2]||'0') || 0;
      return { item_id: id, name, price };
    }).filter(i=>i.item_id);
  }
  function parseInteractionsCSV(text){
    const lines = text.split(/\r?\n/).filter(l=>l.trim());
    let start = 0;
    if(lines[0] && /user|item/i.test(lines[0])) start = 1;
    state.interactions = lines.slice(start).map(l=>{
      const cols = safeSplit(l);
      const user_id = String(cols[0]||'');
      const item_id = String(cols[1]||'');
      const timestamp = cols[2] || '';
      const event_type = cols[3] || '';
      const rating = parseFloat(cols[4]||'0') || 0;
      return { user_id, item_id, timestamp, event_type, rating };
    }).filter(r=>r.user_id && r.item_id);
  }

  // ---------- BUILD AUX MAPS ----------
  function buildMaps(){
    state.avgRating = new Map();
    state.itemToUsers = new Map();
    state.userToItems = new Map();
    const ratingAcc = {};
    state.interactions.forEach(r=>{
      if(!state.itemToUsers.has(r.item_id)) state.itemToUsers.set(r.item_id, new Set());
      state.itemToUsers.get(r.item_id).add(r.user_id);
      if(!state.userToItems.has(r.user_id)) state.userToItems.set(r.user_id, []);
      state.userToItems.get(r.user_id).push({ item_id: r.item_id, rating: r.rating, ts: r.timestamp });
      ratingAcc[r.item_id] = ratingAcc[r.item_id] || [];
      ratingAcc[r.item_id].push(+r.rating || 0);
    });
    Object.keys(ratingAcc).forEach(it => state.avgRating.set(it, mean(ratingAcc[it])));
  }

  // ---------- UI: populate selectors ----------
  function populateSelectors(){
    // location filter
    const locs = uniq(state.users.map(u=>u.location)).filter(Boolean).sort();
    const lf = $('location-filter'); lf.innerHTML = '<option value="">-- All Locations --</option>';
    locs.forEach(l=> lf.appendChild(new Option(l,l)));

    // items selectors
    const itemSelects = ['select-item','cb-item-select','mf-item'];
    itemSelects.forEach(id=>{
      const s = $(id); if(!s) return;
      s.innerHTML = '<option value="">-- choose item --</option>';
      state.items.forEach(it => s.appendChild(new Option(`${it.name} (${it.item_id})`, it.item_id)));
    });

    // mf user
    const mfUser = $('mf-user'); if(mfUser){
      mfUser.innerHTML = '<option value="">-- choose user --</option>';
      state.users.forEach(u => mfUser.appendChild(new Option(u.user_id, u.user_id)));
    }

    // mf item selected if exists
    const mfItem = $('mf-item'); if(mfItem){
      mfItem.innerHTML = '<option value="">-- choose item --</option>';
      state.items.forEach(it => mfItem.appendChild(new Option(it.name, it.item_id)));
    }
  }

  // ---------- Auto-load (tries multiple paths) ----------
  async function autoLoad(){
    $('st-users').innerText = 'Users: trying auto-load...';
    const ures = await tryFetchText('users_clean.csv');
    if(ures){ parseUsersCSV(ures.text); $('st-users').innerText = `Users: loaded (${state.users.length}) from ${ures.path}`; } else $('st-users').innerText = 'Users: not found';

    const ires = await tryFetchText('items_clean.csv');
    if(ires){ parseItemsCSV(ires.text); $('st-items').innerText = `Items: loaded (${state.items.length}) from ${ires.path}`; } else $('st-items').innerText = 'Items: not found';

    const xres = await tryFetchText('interactions_clean.csv');
    if(xres){ parseInteractionsCSV(xres.text); $('st-inter').innerText = `Interactions: loaded (${state.interactions.length}) from ${xres.path}`; } else $('st-inter').innerText = 'Interactions: not found';

    // try embeddings
    for(const name of ['item_embeddings.json','embeddings.json','itemEmbeddings.json']){
      try{
        const r = await fetch('data/processed/'+name);
        if(r.ok){
          const j = await r.json();
          state.itemEmbeddings = j.item_embeddings || j.itemEmbeddings || j.items || j;
          state.userEmbeddings = j.user_embeddings || j.userEmbeddings || null;
          $('st-emb').innerText = `Embeddings: loaded from data/processed/${name}`;
          break;
        }
      }catch(e){}
    }
    buildMaps();
    populateSelectors();
    drawEDA();
  }

  // ---------- File uploads ----------
  function bindUploadInputs(){
    $('file-users').addEventListener('change', async e=>{
      const f = e.target.files[0]; if(!f) return;
      const txt = await f.text();
      parseUsersCSV(txt); $('st-users').innerText = `Users: uploaded (${state.users.length})`;
      buildMaps(); populateSelectors(); drawEDA();
    });
    $('file-items').addEventListener('change', async e=>{
      const f = e.target.files[0]; if(!f) return;
      const txt = await f.text();
      parseItemsCSV(txt); $('st-items').innerText = `Items: uploaded (${state.items.length})`;
      buildMaps(); populateSelectors(); drawEDA();
    });
    $('file-inter').addEventListener('change', async e=>{
      const f = e.target.files[0]; if(!f) return;
      const txt = await f.text();
      parseInteractionsCSV(txt); $('st-inter').innerText = `Interactions: uploaded (${state.interactions.length})`;
      buildMaps(); populateSelectors(); drawEDA();
    });
    $('file-emb').addEventListener('change', async e=>{
      const f = e.target.files[0]; if(!f) return;
      const j = JSON.parse(await f.text());
      state.itemEmbeddings = j.item_embeddings || j.itemEmbeddings || j.items || j;
      state.userEmbeddings = j.user_embeddings || j.userEmbeddings || null;
      $('st-emb').innerText = `Embeddings: uploaded`;
    });
    // secondary embedding upload near history
    $('file-emb-2').addEventListener('change', async e=>{
      const f = e.target.files[0]; if(!f) return;
      const j = JSON.parse(await f.text());
      state.itemEmbeddings = j.item_embeddings || j.itemEmbeddings || j.items || j;
      state.userEmbeddings = j.user_embeddings || j.userEmbeddings || null;
      $('note-emb2').innerText = 'Embeddings uploaded.';
    });
  }

  // ---------- EDA ----------
  let edaScatter=null, histRating=null, histPrice=null;
  function drawEDA(){
    if(!state.items || state.items.length===0) return;
    // scatter price vs avg rating (use avgRating map, fallback 0)
    const pts = state.items.map(it => ({ x: it.price || 0, y: state.avgRating.get(it.item_id) || 0, id: it.item_id, name: it.name }));
    const ctx = $('eda-scatter').getContext('2d');
    if(edaScatter) edaScatter.destroy();
    edaScatter = new Chart(ctx, {
      type: 'scatter',
      data: { datasets: [{ label: 'Price vs Avg Rating', data: pts.map(p=>({x:p.x,y:p.y})), backgroundColor:'#ff66b2' }] },
      options: {
        plugins:{ tooltip:{ callbacks:{ label(ctx){ const p = pts[ctx.dataIndex]; return `${p.id} — ${p.name} : $${p.x} / ${p.y.toFixed(2)}`; } } } },
        scales:{ x:{ title:{display:true,text:'Price ($)'} }, y:{ title:{display:true,text:'Avg Rating'} } },
        onClick(evt, elems){ if(!elems.length) return; const idx = elems[0].index; const id = pts[idx].id; $('select-item').value = id; updateHistoryForItem(id); doContentBasedFromUI(); }
      }
    });
    // rating histogram
    const ratings = state.items.map(it => state.avgRating.get(it.item_id) || 0);
    const prices = state.items.map(it => it.price || 0);
    // rating hist
    if(histRating) histRating.destroy();
    histRating = new Chart($('hist-rating').getContext('2d'), {
      type: 'bar',
      data: { labels: ['0','1','2','3','4','5'], datasets:[{ label:'Avg Rating Count', data: [0,0,0,0,0,0].map(()=>0), backgroundColor:'#ff66b2' }]},
      options: { plugins:{legend:{display:false}} }
    });
    // compute buckets
    const bucket = [0,1,2,3,4,5].map(_=>0);
    ratings.forEach(r => { const b = Math.max(0, Math.min(5, Math.round(r))); bucket[b]++; });
    histRating.data.datasets[0].data = bucket; histRating.update();
    // price hist (simple 10 bins)
    const maxP = Math.max(...prices,1); const bins = 10; const counts = Array(bins).fill(0);
    prices.forEach(p => { const idx = Math.min(bins-1, Math.floor((p/maxP)*bins)); counts[idx]++; });
    if(histPrice) histPrice.destroy();
    histPrice = new Chart($('hist-price').getContext('2d'), {
      type: 'bar',
      data: { labels: Array.from({length:bins},(_,i)=> (i+1)), datasets:[{ label:'Price distribution', data:counts, backgroundColor:'#ffb3d9' }]},
      options:{ plugins:{legend:{display:false}}, scales:{ x:{title:{display:true,text:'Price bin'}}, y:{title:{display:true,text:'Count'}} } }
    });
    $('note-eda').innerText = `EDA ready — ${state.items.length} items.`;
  }

  // ---------- Purchase history for item ----------
  function updateHistoryForItem(itemId){
    const item = state.items.find(it=>it.item_id===itemId);
    $('item-name-display').innerText = item ? item.name : 'None';
    const hist = state.interactions.filter(r => r.item_id === itemId).map(r=>({ user_id: r.user_id, rating: r.rating, price: (state.items.find(it=>it.item_id===itemId)||{}).price || 0, ts: r.timestamp }));
    const tbody = $('history-table').querySelector('tbody'); tbody.innerHTML = '';
    hist.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(h.user_id)}</td><td>${(h.rating||0).toFixed(2)}</td><td>${formatMoney(h.price)}</td><td>${escapeHtml(h.ts)}</td>`;
      tbody.appendChild(tr);
    });
    $('note-item').innerText = `Displayed ${hist.length} interactions for item ${itemId}`;
  }

  // ---------- CONTENT-BASED ----------
  function tokenize(s){
    if(!s) return [];
    return s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(t=>t.length>2);
  }
  function jaccard(a,b){ if(!a||!b) return 0; const A=new Set(a), B=new Set(b); const inter=[...A].filter(x=>B.has(x)).length; const uni=new Set([...A,...B]).size; return uni?inter/uni:0; }
  function cosine(a,b){ if(!a||!b) return 0; let dot=0,na=0,nb=0; const n=Math.min(a.length,b.length); for(let i=0;i<n;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; } return (na&&nb)? dot/(Math.sqrt(na)*Math.sqrt(nb)) : 0; }

  function doContentBased(anchorId){
    if(!anchorId){ $('note-cb').innerText = 'Select an anchor item.'; return; }
    const anchorItem = state.items.find(it=>it.item_id===anchorId);
    const results = [];
    if(state.itemEmbeddings && state.itemEmbeddings[anchorId]){
      const anchorVec = state.itemEmbeddings[anchorId];
      state.items.forEach(it=>{
        if(it.item_id===anchorId) return;
        const vec = state.itemEmbeddings[it.item_id];
        const sim = vec ? cosine(anchorVec, vec) : 0;
        results.push({ id: it.item_id, name: it.name, sim, avg: state.avgRating.get(it.item_id)||0, price: it.price||0 });
      });
    } else {
      const anchorTokens = tokenize(anchorItem ? anchorItem.name : '');
      state.items.forEach(it=>{
        if(it.item_id===anchorId) return;
        const sim = jaccard(anchorTokens, tokenize(it.name));
        results.push({ id: it.item_id, name: it.name, sim, avg: state.avgRating.get(it.item_id)||0, price: it.price||0 });
      });
    }
    results.sort((a,b)=>b.sim - a.sim);
    const top = results.slice(0,10);
    const tbody = $('cb-table').querySelector('tbody'); tbody.innerHTML = '';
    top.forEach((r,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}</td><td>${r.sim.toFixed(3)}</td><td>${(r.avg||0).toFixed(2)}</td><td>${formatMoney(r.price)}</td>`;
      tbody.appendChild(tr);
    });
    $('note-cb').innerText = `Found ${top.length} similar items (anchor ${anchorId}).`;
  }
  function doContentBasedFromUI(){ const id = $('cb-item-select').value || $('select-item').value; doContentBased(id); }

  // ---------- TOP-N global (smart weighting) ----------
  function normalizeArr(arr){
    if(!arr || arr.length===0) return [];
    const mn = Math.min(...arr), mx = Math.max(...arr);
    if(mx === mn) return arr.map(()=>0);
    return arr.map(v => (v - mn) / (mx - mn));
  }

  function computeTopN(){
    if(!state.items.length){ alert('No items loaded'); return; }
    const profile = $('topn-profile').value;
    let wSim=0.5,wRat=0.4,wPrice=0.1;
    if(profile==='rating'){ wSim=0.2; wRat=0.7; wPrice=0.1; }
    if(profile==='similarity'){ wSim=0.7; wRat=0.2; wPrice=0.1; }

    // sim map: if embeddings available use cos to average vector; else use popularity proxy
    const simMap = new Map();
    if(state.itemEmbeddings && Object.keys(state.itemEmbeddings).length>0){
      const keys = Object.keys(state.itemEmbeddings);
      const kdim = state.itemEmbeddings[keys[0]].length;
      const avg = Array(kdim).fill(0); let cnt=0;
      keys.forEach(k=>{ const v=state.itemEmbeddings[k]; if(v && v.length===kdim){ for(let i=0;i<kdim;i++) avg[i]+=v[i]; cnt++; }});
      if(cnt) for(let i=0;i<kdim;i++) avg[i]/=cnt;
      state.items.forEach(it => { const v = state.itemEmbeddings[it.item_id]; simMap.set(it.item_id, v?cosine(avg,v):0); });
    } else {
      // popularity: number of unique users purchased
      const pop = state.items.map(it => (state.itemToUsers.get(it.item_id) || new Set()).size);
      const maxPop = Math.max(...pop,1);
      state.items.forEach((it, idx) => simMap.set(it.item_id, pop[idx]/maxPop));
    }

    const sims = state.items.map(it => simMap.get(it.item_id) || 0);
    const simN = normalizeArr(sims);
    const rats = state.items.map(it => state.avgRating.get(it.item_id) || 0);
    const ratN = normalizeArr(rats);
    const prices = state.items.map(it => it.price || 0);
    const maxP = Math.max(...prices,1);
    const priceInv = prices.map(p => 1 - (p / maxP));
    const pN = normalizeArr(priceInv);

    const scored = state.items.map((it,i)=> {
      const score = wSim*simN[i] + wRat*ratN[i] + wPrice*pN[i];
      return { id: it.item_id, name: it.name, rating: (state.avgRating.get(it.item_id)||0), price: it.price||0, score };
    }).sort((a,b)=>b.score-a.score).slice(0,10);

    const tbody = $('topn-table').querySelector('tbody'); tbody.innerHTML = '';
    scored.forEach((r,i)=> {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}</td><td>${(r.rating||0).toFixed(2)}</td><td>${formatMoney(r.price)}</td><td>${r.score.toFixed(4)}</td>`;
      tbody.appendChild(tr);
    });
    $('note-topn').innerText = 'Top-10 computed.';
  }

  // ---------- MF (Matrix Factorization) ----------
  // We'll implement a simple MF trained with MSE using tfjs variables (safe)
  let MF_STATE = null;
  async function trainMF(epochs=6, latent=32, batchSize=1024, sampleLimit=50000){
    if(!state.interactions.length){ alert('No interactions loaded'); return; }
    $('mf-status').innerText = 'Preparing data for MF...';
    // build index maps
    const uIds = uniq(state.interactions.map(r=>r.user_id));
    const iIds = uniq(state.interactions.map(r=>r.item_id));
    const userIndex = new Map(uIds.map((u,i)=>[u,i]));
    const itemIndex = new Map(iIds.map((it,j)=>[it,j]));
    // sample interactions to avoid freezing
    const sample = state.interactions.slice(0, Math.min(sampleLimit, state.interactions.length));
    const uIdxs = sample.map(r=>userIndex.get(r.user_id));
    const iIdxs = sample.map(r=>itemIndex.get(r.item_id));
    const ys = sample.map(r=>+r.rating || 0);
    const nUsers = uIds.length, nItems = iIds.length, k = Math.min(latent, 64);

    // variables
    const userEmb = tf.variable(tf.randomNormal([nUsers,k],0,0.05));
    const itemEmb = tf.variable(tf.randomNormal([nItems,k],0,0.05));
    const userBias = tf.variable(tf.zeros([nUsers]));
    const itemBias = tf.variable(tf.zeros([nItems]));
    const globalBias = tf.scalar(mean(ys));
    const optimizer = tf.train.adam(0.01);

    // loss chart
    const ctx = $('mf-loss').getContext('2d');
    const lossChart = new Chart(ctx, { type:'line', data:{ labels:[], datasets:[{label:'MF loss', data:[], borderColor:'#e60073', fill:false}]}, options:{responsive:true} });

    MF_STATE = { userIndex, itemIndex, userEmb, itemEmb, userBias, itemBias, globalBias, trained:false };

    const numExamples = uIdxs.length;
    const steps = Math.max(1, Math.floor(numExamples / batchSize));
    for(let epoch=0; epoch<epochs; epoch++){
      let epochLoss = 0;
      for(let s=0; s<steps; s++){
        const start = s*batchSize; const end = Math.min(numExamples, start+batchSize);
        const batchU = uIdxs.slice(start,end), batchI = iIdxs.slice(start,end), batchY = ys.slice(start,end);
        const uT = tf.tensor1d(batchU,'int32'), iT = tf.tensor1d(batchI,'int32'), yT = tf.tensor1d(batchY,'float32');
        const lossTensor = optimizer.minimize(()=> {
          const uE = tf.gather(userEmb, uT);
          const iE = tf.gather(itemEmb, iT);
          const preds = tf.sum(tf.mul(uE,iE),1).add(tf.gather(userBias, uT)).add(tf.gather(itemBias, iT)).add(globalBias);
          const loss = tf.losses.meanSquaredError(yT, preds);
          return loss;
        }, true);
        const lval = (await lossTensor.data())[0];
        epochLoss += lval;
        tf.dispose([uT,iT,yT,lossTensor]);
        await tf.nextFrame();
      }
      const avgLoss = epochLoss / steps;
      lossChart.data.labels.push(`e${epoch+1}`); lossChart.data.datasets[0].data.push(avgLoss); lossChart.update();
      $('mf-status').innerText = `Epoch ${epoch+1}/${epochs} — loss ${avgLoss.toFixed(4)}`;
    }
    MF_STATE.trained = true; state.MF = MF_STATE; $('mf-status').innerText = 'MF training completed'; $('btn-mf-predict').disabled = false;
  }

  function predictMF(){
    if(!MF_STATE || !MF_STATE.trained){ alert('Train MF first'); return; }
    const uid = $('mf-user').value, iid = $('mf-item').value;
    if(!uid || !iid){ alert('Select user & item'); return; }
    const ui = MF_STATE.userIndex.get(uid), ii = MF_STATE.itemIndex.get(iid);
    if(ui===undefined || ii===undefined){ alert('User or item not in training sample'); return; }
    tf.tidy(()=>{
      const ue = tf.gather(MF_STATE.userEmb, tf.tensor1d([ui],'int32'));
      const ie = tf.gather(MF_STATE.itemEmb, tf.tensor1d([ii],'int32'));
      const pred = tf.sum(tf.mul(ue,ie),1).add(tf.gather(MF_STATE.userBias, tf.tensor1d([ui],'int32'))).add(tf.gather(MF_STATE.itemBias, tf.tensor1d([ii],'int32'))).add(MF_STATE.globalBias);
      const val = pred.dataSync()[0];
      $('mf-pred').innerText = `Predicted rating for user ${uid} on item ${iid}: ${val.toFixed(2)} / 5`;
    });
  }

  // ---------- Two-Tower (BPR-like) ----------
  let TT_STATE = null;
  async function prepareTwoTower(){
    if(!state.items.length || !state.interactions.length){ alert('Load items and interactions first'); return; }
    $('tt-status').innerText = 'Two-Tower prepared. Ready to train.'; $('tt-train').disabled = false;
    TT_STATE = { trained:false };
  }

  async function trainTwoTower({epochs=6, embDim=32, batchSize=512, sampleLimit=50000} = {}){
    if(!TT_STATE){ alert('Press Prepare Two-Tower first'); return; }
    $('tt-status').innerText = 'Preparing Two-Tower data...';
    const usersList = uniq(state.interactions.map(r=>r.user_id));
    const itemsList = uniq(state.items.map(i=>i.item_id));
    const uIndex = new Map(usersList.map((u,i)=>[u,i]));
    const iIndex = new Map(itemsList.map((it,j)=>[it,j]));
    const pairs = state.interactions.map(r=>({ u: uIndex.get(r.user_id), i: iIndex.get(r.item_id) })).filter(p=>p.u!=null && p.i!=null);
    const sample = pairs.slice(0, Math.min(sampleLimit, pairs.length));
    const numU = usersList.length, numI = itemsList.length;
    const k = Math.min(embDim, 64);

    // variables
    const userEmb = tf.variable(tf.randomNormal([numU,k],0,0.05));
    const itemEmb = tf.variable(tf.randomNormal([numI,k],0,0.05));
    const W_u = tf.variable(tf.randomNormal([k,k],0,0.05));
    const b_u = tf.variable(tf.zeros([k]));
    const W_i = tf.variable(tf.randomNormal([k,k],0,0.05));
    const b_i = tf.variable(tf.zeros([k]));
    const optimizer = tf.train.adam(0.005);

    TT_STATE = { userEmb, itemEmb, W_u, b_u, W_i, b_i, usersList, itemsList, uIndex, iIndex, trained:false };

    // loss chart
    const ctx = $('tt-loss').getContext('2d');
    const lossChart = new Chart(ctx, { type:'line', data:{ labels:[], datasets:[{label:'TT loss', data:[], borderColor:'#e60073', fill:false}]}, options:{responsive:true} });

    const n = sample.length;
    const steps = Math.max(1, Math.floor(n / batchSize));
    for(let epoch=0; epoch<epochs; epoch++){
      let epochLoss = 0;
      for(let s=0; s<steps; s++){
        const start = s*batchSize, end = Math.min(n, start+batchSize);
        const batch = sample.slice(start,end);
        const uIdx = batch.map(p=>p.u), posIdx = batch.map(p=>p.i);
        const negIdx = batch.map(()=> Math.floor(Math.random()*numI));
        const uT = tf.tensor1d(uIdx,'int32'), pT = tf.tensor1d(posIdx,'int32'), nT = tf.tensor1d(negIdx,'int32');

        const lossT = optimizer.minimize(()=> {
          const uE = tf.gather(userEmb, uT);
          const pE = tf.gather(itemEmb, pT);
          const nE = tf.gather(itemEmb, nT);
          const uH = tf.relu(tf.add(tf.matMul(uE, W_u), b_u));
          const pH = tf.relu(tf.add(tf.matMul(pE, W_i), b_i));
          const nH = tf.relu(tf.add(tf.matMul(nE, W_i), b_i));
          const posS = tf.sum(tf.mul(uH, pH),1);
          const negS = tf.sum(tf.mul(uH, nH),1);
          const diff = tf.sub(posS, negS);
          const loss = tf.neg(tf.mean(tf.log(tf.sigmoid(diff).add(1e-7))));
          return loss;
        }, true);
        const lval = (await lossT.data())[0];
        epochLoss += lval;
        tf.dispose([uT,pT,nT,lossT]);
        await tf.nextFrame();
      }
      const avgLoss = epochLoss / steps;
      lossChart.data.labels.push(`e${epoch+1}`); lossChart.data.datasets[0].data.push(avgLoss); lossChart.update();
      $('tt-status').innerText = `Two-Tower epoch ${epoch+1}/${epochs} — loss ${avgLoss.toFixed(4)}`;
    }
    TT_STATE.trained = true; $('tt-status').innerText = 'Two-Tower training completed'; $('tt-test').disabled = false;
    renderTTProjection(TT_STATE.itemEmb);
  }

  // SVD projection of sample of itemEmb
  async function renderTTProjection(itemEmbVar, sampleSize=400){
    const count = Math.min(sampleSize, itemEmbVar.shape[0]);
    const idxs = Array.from({length:count}, (_,i)=>i);
    const t = tf.gather(itemEmbVar, tf.tensor1d(idxs,'int32'));
    const svd = tf.svd(t, true);
    const u = svd.u; const s = svd.s;
    const coords = u.mul(s.reshape([1, s.shape[0]])).slice([0,0],[u.shape[0],2]);
    const arr = await coords.array();
    const box = $('tt-embed-proj'); box.innerHTML = '';
    const canvas = document.createElement('canvas'); canvas.width = box.clientWidth || 700; canvas.height = box.clientHeight || 220; box.appendChild(canvas);
    const ctx = canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const xs = arr.map(a=>a[0]), ys = arr.map(a=>a[1]);
    const minx=Math.min(...xs), maxx=Math.max(...xs), miny=Math.min(...ys), maxy=Math.max(...ys);
    for(let i=0;i<arr.length;i++){
      const x = ((arr[i][0]-minx)/(maxx-minx||1))*(canvas.width-30)+15;
      const y = ((arr[i][1]-miny)/(maxy-miny||1))*(canvas.height-30)+15;
      ctx.beginPath(); ctx.arc(x,y,3,0,2*Math.PI); ctx.fillStyle='#e60073'; ctx.fill();
    }
    t.dispose(); u.dispose(); s.dispose(); coords.dispose();
  }

  // Two-Tower test: pick random user >=20 ratings, show 3 tables
  function twoTowerTest(){
    const counts = {};
    state.interactions.forEach(r=> counts[r.user_id] = (counts[r.user_id]||0)+1);
    const candidates = Object.keys(counts).filter(u=>counts[u]>=20);
    if(!candidates.length){ alert('No user with >=20 interactions'); return; }
    const userId = candidates[Math.floor(Math.random()*candidates.length)];
    // left: user's top-10 historical (rating desc)
    const hist = (state.userToItems.get(userId) || []).sort((a,b)=>(b.rating - a.rating)).slice(0,10);
    const leftT = $('tt-left').querySelector('tbody'); leftT.innerHTML = '';
    hist.forEach((h,i) => leftT.appendChild(trRow(i+1, h.item_id, (h.rating||0).toFixed(2), getYear(h.item_id))));
    // middle: basic top-10 by avg rating
    const midArr = state.items.map(it=>({ id: it.item_id, name: it.name, score: state.avgRating.get(it.item_id)||0, year:getYear(it.item_id) })).sort((a,b)=>b.score-a.score).slice(0,10);
    const midT = $('tt-mid').querySelector('tbody'); midT.innerHTML = '';
    midArr.forEach((r,i)=> midT.appendChild(trRow(i+1, r.id, r.score.toFixed(2), r.year)));
    // right: use TT_STATE to compute user vector and recommend
    const rightT = $('tt-right').querySelector('tbody'); rightT.innerHTML = '';
    if(!TT_STATE || !TT_STATE.trained){ rightT.innerHTML = `<tr><td colspan="4">Two-Tower not trained.</td></tr>`; }
    else {
      // compute user vector as mean of item embeddings for items the user rated that are in TT_STATE.itemsList
      const histIdx = (state.userToItems.get(userId)||[]).map(h=> TT_STATE.itemsList ? TT_STATE.itemsList.indexOf(h.item_id) : -1).filter(x=>x>=0);
      if(!histIdx.length){ rightT.innerHTML = `<tr><td colspan="4">No overlap with TT index</td></tr>`; }
      else {
        const t = tf.gather(TT_STATE.itemEmb, tf.tensor1d(histIdx,'int32'));
        const uvec = t.mean(0);
        // compute scores vs all items in TT_STATE.itemEmb (batched)
        const embAll = TT_STATE.itemEmb;
        const scores = [];
        const batch = 1024;
        const n = embAll.shape[0];
        for(let i=0;i<n;i+=batch){
          const sub = tf.slice(embAll, [i,0], [Math.min(batch, n-i), embAll.shape[1]]);
          const subArr = sub.arraySync();
          const uArr = uvec.arraySync();
          for(let j=0;j<subArr.length;j++){
            scores.push({ id: TT_STATE.itemsList[i+j], sc: cosine(uArr, subArr[j]) });
          }
          sub.dispose();
        }
        t.dispose(); uvec.dispose();
        scores.sort((a,b)=>b.sc-a.sc);
        scores.slice(0,10).forEach((r,i)=> rightT.appendChild(trRow(i+1, r.id, r.sc.toFixed(4), getYear(r.id))));
      }
    }
    $('tt-results').classList.remove('hidden');
    $('tt-status').innerText = `Two-Tower test done for user ${userId}`;
  }

  // ---------- UTIL small helpers ----------
  function trRow(rank, id, score, year){
    const it = state.items.find(x=>x.item_id===id);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${rank}</td><td>${escapeHtml(id)}</td><td>${escapeHtml(it?it.name:id)}</td><td>${escapeHtml(score)}</td><td>${escapeHtml(year||'')}</td>`;
    return tr;
  }
  function getYear(itemId){ const it = state.items.find(x=>x.item_id===itemId); if(!it) return ''; const m = (it.name||'').match(/(19|20)\d{2}/); return m?m[0]:''; }

  // ---------- Init: bind UI ----------
  function bindUI(){
    // toggle upload panel
    $('btn-upload-toggle').addEventListener('click', ()=> $('upload-panel').classList.toggle('hidden'));
    $('btn-auto-load').addEventListener('click', autoLoad);
    // file inputs
    bindUploadInputs();
    // select item change
    $('select-item').addEventListener('change', e=> updateHistoryForItem(e.target.value));
    // content-based
    $('btn-cb').addEventListener('click', ()=> doContentBasedFromUI());
    // top-n
    $('btn-topn').addEventListener('click', computeTopN);
    // MF
    $('btn-mf-train').addEventListener('click', async ()=> {
      const epochs = Math.max(1, parseInt($('mf-epochs').value || 6));
      await trainMF(epochs, 32, 1024, 50000);
    });
    $('btn-mf-predict').addEventListener('click', predictMF);
    // Two-Tower
    $('tt-load').addEventListener('click', prepareTwoTower);
    $('tt-train').addEventListener('click', async ()=> {
      $('tt-train').disabled = true;
      await trainTwoTower({epochs:6, embDim:32, batchSize:512, sampleLimit:30000});
    });
    $('tt-test').addEventListener('click', twoTowerTest);
    // secondary embedding upload
    $('file-emb-2').addEventListener('change', async e=>{
      const f = e.target.files[0]; if(!f) return;
      const j = JSON.parse(await f.text());
      state.itemEmbeddings = j.item_embeddings || j.itemEmbeddings || j.items || j;
      state.userEmbeddings = j.user_embeddings || j.userEmbeddings || null;
      $('note-emb2').innerText = 'Embeddings loaded.';
    });
  }

  // ---------- Public init entry point ----------
  async function init(){
    bindUI();
    // attempt auto-load after small delay
    setTimeout(()=>{ autoLoad().catch(()=>{}); }, 400);
  }

  // expose public methods if needed
  return { init, state };
})();

// boot
window.addEventListener('DOMContentLoaded', ()=> RecSysApp.init());
