// data.js - responsible for loading CSV/JSON (upload or auto-fetch)
const DATA_BASE = "/data/processed/"; // when deployed on GitHub Pages ensure files are here

let users = [];
let items = [];
let interactions = [];
let embeddings = { user_embeddings: null, item_embeddings: null };

// Utility: attempt to fetch file from repo (GitHub Pages), returns text or null
async function tryFetchText(relPath){
  try{
    const resp = await fetch(relPath);
    if(!resp.ok) return null;
    return await resp.text();
  }catch(e){ return null; }
}

// Utility: attempt to fetch JSON
async function tryFetchJSON(relPath){
  try{
    const resp = await fetch(relPath);
    if(!resp.ok) return null;
    return await resp.json();
  }catch(e){ return null; }
}

// Auto-load from GitHub Pages (used on page load)
async function autoLoadFromRepo(){
  // try CSVs
  const utxt = await tryFetchText(DATA_BASE + "users_clean.csv");
  const itxt = await tryFetchText(DATA_BASE + "items_clean.csv");
  const txt2 = await tryFetchText(DATA_BASE + "interactions_clean.csv");

  if(utxt) parseUsers(utxt), document.getElementById("status-users").innerText = "Users — loaded from repo";
  if(itxt) parseItems(itxt), document.getElementById("status-items").innerText = "Items — loaded from repo";
  if(txt2) parseInteractions(txt2), document.getElementById("status-interactions").innerText = "Interactions — loaded from repo";

  // try embeddings JSON (common filenames)
  let j = await tryFetchJSON(DATA_BASE + "item_embeddings.json");
  if(!j) j = await tryFetchJSON(DATA_BASE + "embeddings.json");
  if(j){
    // support either {item_embeddings:..., user_embeddings:...} or item_embeddings alone
    embeddings.item_embeddings = j.item_embeddings || j.itemEmbeddings || j.items || j;
    embeddings.user_embeddings = j.user_embeddings || j.userEmbeddings || j.users || null;
    document.getElementById("status-emb").innerText = "Embeddings — loaded from repo";
  }
}

// Parsing functions (CSV expected ; separated as provided)
function parseUsers(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=="");
  const headers = lines[0].split(/[;,]/).map(h=>h.trim());
  const rows = lines.slice(1);
  users = rows.map(line=>{
    const cols = line.split(/[;,]/);
    const obj = {};
    headers.forEach((h,i)=> obj[h] = cols[i] ? cols[i].trim() : "");
    // tolerate both header names or default order
    const user_id = obj.user_id || obj.CustomerID || cols[0];
    const location = obj.location || obj.Country || cols[1] || "";
    return { user_id: String(user_id), location: location };
  });
  document.getElementById("note-users").innerText = `${users.length} users loaded`;
}

// items CSV: item_id;name;price
function parseItems(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=="");
  const headers = lines[0].split(/[;,]/).map(h=>h.trim());
  const rows = lines.slice(1);
  items = rows.map(line=>{
    const cols = line.split(/[;,]/);
    const obj = {};
    headers.forEach((h,i)=> obj[h]= cols[i] ? cols[i].trim() : "");
    const item_id = obj.item_id || obj.StockCode || cols[0];
    const name = obj.name || obj.Description || cols[1] || "";
    const price = parseFloat(obj.price || obj.UnitPrice || cols[2] || "0") || 0;
    return { item_id: String(item_id), name, price };
  });
  document.getElementById("note-items").innerText = `${items.length} items loaded`;
}

// interactions CSV: user_id;item_id;timestamp;event_type;rating
function parseInteractions(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=="");
  const headers = lines[0].split(/[;,]/).map(h=>h.trim());
  const rows = lines.slice(1);
  interactions = rows.map(line=>{
    const cols = line.split(/[;,]/);
    const obj = {};
    headers.forEach((h,i)=> obj[h]= cols[i] ? cols[i].trim() : "");
    const user_id = String(obj.user_id || obj.CustomerID || cols[0]);
    const item_id = String(obj.item_id || obj.StockCode || cols[1]);
    const timestamp = obj.timestamp || obj.InvoiceDate || cols[2] || "";
    const event_type = obj.event_type || cols[3] || "";
    const rating = parseFloat(obj.rating || obj.Quantity || cols[4] || "0") || 0;
    return { user_id, item_id, timestamp, event_type, rating };
  });
  document.getElementById("note-interactions").innerText = `${interactions.length} interactions loaded`;
}

// Hook for file inputs (browser upload)
function hookFileInputs(){
  document.getElementById("file-users").addEventListener("change", (ev)=>{
    const f = ev.target.files[0];
    if(!f) return;
    Papa.parse(f, { header:true, skipEmptyLines:true, worker:true, complete: (res)=>{
      // serialize back to csv-text for parser reuse
      const csvText = Papa.unparse(res.data);
      parseUsers(csvText);
      document.getElementById("status-users").innerText = "Users — loaded from local file";
    }});
  });

  document.getElementById("file-items").addEventListener("change", (ev)=>{
    const f = ev.target.files[0];
    if(!f) return;
    Papa.parse(f, { header:true, skipEmptyLines:true, worker:true, complete: (res)=>{
      const csvText = Papa.unparse(res.data);
      parseItems(csvText);
      populateItemSelect();
      document.getElementById("status-items").innerText = "Items — loaded from local file";
    }});
  });

  document.getElementById("file-interactions").addEventListener("change", (ev)=>{
    const f = ev.target.files[0];
    if(!f) return;
    Papa.parse(f, { header:true, skipEmptyLines:true, worker:true, complete: (res)=>{
      const csvText = Papa.unparse(res.data);
      parseInteractions(csvText);
      buildAuxiliaryMaps();
      document.getElementById("status-interactions").innerText = "Interactions — loaded from local file";
    }});
  });

  document.getElementById("file-embeddings").addEventListener("change", (ev)=>{
    const f = ev.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = e=>{
      try{
        const j = JSON.parse(e.target.result);
        embeddings.item_embeddings = j.item_embeddings || j.itemEmbeddings || j.items || j;
        embeddings.user_embeddings = j.user_embeddings || j.userEmbeddings || j.users || null;
        document.getElementById("status-emb").innerText = "Embeddings — loaded from local file";
        document.getElementById("note-embeddings").innerText = "Embeddings ready";
      }catch(err){
        document.getElementById("note-embeddings").innerText = "Invalid JSON";
      }
    };
    r.readAsText(f);
  });
}

// Auxiliary maps for performance
let itemToUsers = new Map(); // item_id -> Set(user_id)
let avgRatingMap = new Map(); // item_id -> avg rating
function buildAuxiliaryMaps(){
  itemToUsers.clear(); avgRatingMap.clear();
  for(const it of items) itemToUsers.set(it.item_id, new Set());
  const ratingAcc = {};
  for(const row of interactions){
    if(!itemToUsers.has(row.item_id)) itemToUsers.set(row.item_id, new Set());
    itemToUsers.get(row.item_id).add(row.user_id);
    if(!ratingAcc[row.item_id]) ratingAcc[row.item_id] = [];
    ratingAcc[row.item_id].push(+row.rating || 0);
  }
  Object.keys(ratingAcc).forEach(id=>{
    const arr = ratingAcc[id];
    const avg = arr.reduce((s,v)=>s+v,0)/arr.length;
    avgRatingMap.set(id, avg);
  });
}

// Initialization on load
window.addEventListener("load", async ()=>{
  hookFileInputs();
  // attempt auto-load from repo
  await autoLoadFromRepo();
  // if items loaded either way, populate selects
  if(items.length>0) populateItemSelect();
  if(users.length>0) populateLocationButtons();
  if(interactions.length>0) buildAuxiliaryMaps();
});
