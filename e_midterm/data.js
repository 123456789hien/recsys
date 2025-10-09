// data.js — load clean CSVs from data/processed/
let interactions = []; // array of {user_id,item_id,timestamp,event_type,rating}
let items = [];        // array of {item_id,name,price}
let users = [];        // array of {user_id,location}
let embeddings = {};   // loaded JSON from upload

// helpers log to notes panel
function notesLog(msg){
  const container = document.getElementById('notes-log');
  if(!container) return;
  const p = document.createElement('div');
  p.textContent = `${new Date().toLocaleTimeString()} — ${msg}`;
  container.prepend(p);
}

// robust CSV fetch + parse (delimiter semicolon by default)
async function fetchAndParseCSV(path, delimiter=';'){
  const res = await fetch(path);
  if(!res.ok) throw new Error(`Failed to fetch ${path} (${res.status})`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length < 1) return [];
  const header = lines[0].split(delimiter).map(h=>h.trim());
  const out = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(delimiter);
    // pad if needed
    while(cols.length < header.length) cols.push('');
    const obj = {};
    header.forEach((h, idx)=> obj[h] = cols[idx] ? cols[idx].trim() : '');
    out.push(obj);
  }
  return out;
}

// main load: call from script.js
async function loadAllCleanData(){
  notesLog('Start loading CSVs from data/processed/ ...');
  try{
    const [intData, itemData, userData] = await Promise.all([
      fetchAndParseCSV('data/processed/interactions_clean.csv',';'),
      fetchAndParseCSV('data/processed/items_clean.csv',';'),
      fetchAndParseCSV('data/processed/users_clean.csv',';')
    ]);
    // normalize fields
    interactions = intData.map(r=>({
      user_id: r['user_id'] ?? r['CustomerID'] ?? r['UserID'],
      item_id: r['item_id'] ?? r['StockCode'] ?? r['ItemID'],
      timestamp: r['timestamp'] ?? r['InvoiceDate'] ?? r['Timestamp'] ?? '',
      event_type: r['event_type'] ?? '',
      rating: Number(r['rating'] ?? r['Rating'] ?? r['Quantity'] ?? 0)
    }));
    items = itemData.map(r=>({
      item_id: r['item_id'] ?? r['itemID'] ?? r['StockCode'],
      name: r['name'] ?? r['Description'] ?? '',
      price: Number(r['price'] ?? r['UnitPrice'] ?? 0)
    }));
    users = userData.map(r=>({
      user_id: r['user_id'] ?? r['CustomerID'] ?? '',
      location: r['location'] ?? r['Country'] ?? ''
    }));
    notesLog(`Loaded CSVs: interactions=${interactions.length}, items=${items.length}, users=${users.length}`);
    // build indexes for fast lookup
    buildIndexes();
    return true;
  }catch(err){
    console.error(err);
    notesLog('Error loading CSVs: ' + err.message);
    return false;
  }
}

/* Index structures for speed:
   - itemId -> Set(users who bought it)
   - itemId -> average rating
*/
const itemUsersMap = new Map();
const itemAvgRatingMap = new Map();
let minPrice=Infinity, maxPrice=-Infinity, maxRating=0;

function buildIndexes(){
  itemUsersMap.clear();
  itemAvgRatingMap.clear();
  // item users
  interactions.forEach(it=>{
    const iid = it.item_id;
    const uid = it.user_id;
    if(!itemUsersMap.has(iid)) itemUsersMap.set(iid, new Set());
    itemUsersMap.get(iid).add(uid);
    // stats
    if(it.rating && Number(it.rating) > maxRating) maxRating = Number(it.rating);
  });
  // average rating per item
  items.forEach(it=>{
    const iid = it.item_id;
    const arr = interactions.filter(x=>x.item_id === iid).map(x=>Number(x.rating)||0);
    const avg = arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
    itemAvgRatingMap.set(iid, avg);
    const p = Number(it.price) || 0;
    if(p < minPrice) minPrice = p;
    if(p > maxPrice) maxPrice = p;
  });
  if(!isFinite(minPrice)) minPrice = 0;
  if(maxPrice < 0) maxPrice = 1;
  if(maxRating <= 0) maxRating = 1;
  notesLog(`Built indexes: itemUsers=${itemUsersMap.size}, minPrice=${minPrice.toFixed(2)}, maxPrice=${maxPrice.toFixed(2)}, maxRating=${maxRating}`);
}

// export (global variables accessible by script.js)
window._DATA = {
  interactions, items, users, embeddings,
  itemUsersMap, itemAvgRatingMap, minPrice, maxPrice, maxRating,
  loadAllCleanData,
  notesLog,
  buildIndexes
};
