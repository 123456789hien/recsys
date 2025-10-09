// data.js
// - Loads CSVs from data/processed/ if present (auto-load)
// - Or supports local upload via file inputs (handled in app.js).
// - Exposes the arrays: users, items, interactions
// - Items expected columns: item_id;name;price (can also accept StockCode/Description/UnitPrice)
// - Interactions: user_id;item_id;timestamp;event_type;rating

let users = [];         // {user_id, location}
let items = [];         // {item_id, name, price}
let interactions = [];  // {user_id, item_id, timestamp, event_type, rating}
let embeddingsJSON = null; // optional precomputed embeddings (loaded later)

// helper to attempt fetch; returns null on error
async function tryFetchText(path){
  try {
    const r = await fetch(path);
    if(!r.ok) return null;
    return await r.text();
  } catch(e){ return null; }
}

async function autoLoadIfPresent(){
  // try load from data/processed/
  const base = "data/processed/";
  const u = await tryFetchText(base + "users_clean.csv");
  const it = await tryFetchText(base + "items_clean.csv");
  const ix = await tryFetchText(base + "interactions_clean.csv");
  if(u) parseUsersCSV(u), document.getElementById("st-users").innerText="Users: loaded (repo)";
  if(it) parseItemsCSV(it), document.getElementById("st-items").innerText="Items: loaded (repo)";
  if(ix) parseInteractionsCSV(ix), document.getElementById("st-inter").innerText="Interactions: loaded (repo)";
  // embeddings (optional)
  try {
    const embResp = await fetch(base + "item_embeddings.json");
    if(embResp.ok){
      const j = await embResp.json();
      embeddingsJSON = j;
      document.getElementById("st-emb").innerText="Embeddings: loaded (repo)";
    }
  } catch(e){ /*ignore*/ }
}

// parse helpers (semicolon/csv tolerant)
function splitLine(line){
  // handle ; or , as separators
  return line.split(/;|,/).map(s=>s.trim());
}

function parseUsersCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=="");
  // try header detection
  let start = 0;
  if(lines[0].toLowerCase().includes("user") || lines[0].toLowerCase().includes("customer"))
    start = 1;
  users = [];
  for(let i=start;i<lines.length;i++){
    const cols = splitLine(lines[i]);
    if(cols.length<1) continue;
    const user_id = String(cols[0]);
    const location = cols[1] || "";
    users.push({user_id, location});
  }
}

function parseItemsCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=="");
  let start = 0;
  if(lines[0].toLowerCase().includes("item") || lines[0].toLowerCase().includes("stockcode"))
    start = 1;
  items = [];
  for(let i=start;i<lines.length;i++){
    const cols = splitLine(lines[i]);
    if(cols.length<2) continue;
    const item_id = String(cols[0]);
    const name = cols[1] || "";
    const price = parseFloat(cols[2] || "0") || 0;
    items.push({item_id, name, price});
  }
}

function parseInteractionsCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=="");
  let start = 0;
  if(lines[0].toLowerCase().includes("user") && lines[0].toLowerCase().includes("item"))
    start = 1;
  interactions = [];
  for(let i=start;i<lines.length;i++){
    const cols = splitLine(lines[i]);
    if(cols.length<2) continue;
    const user_id = String(cols[0]);
    const item_id = String(cols[1]);
    const timestamp = cols[2] || "";
    const event_type = cols[3] || "";
    const rating = parseFloat(cols[4] || "0") || 0;
    interactions.push({user_id, item_id, timestamp, event_type, rating});
  }
}

// export: try auto load on script load
window.addEventListener("load", ()=>{
  // attempt auto-load - app.js will initialize UI after these calls
  autoLoadIfPresent();
});
