// data.js
// Loads CSVs from data/processed/ and exposes arrays: interactions, items, users

let interactions = [];
let items = [];
let users = [];
let embeddings = {}; // will be populated by upload

// small helper to append note to notes-log
function addLog(text){
  const el = document.getElementById?.('notes-log');
  if(!el) return;
  const p = document.createElement('div');
  p.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
  el.prepend(p);
}

// robust CSV parse: simple split on ';' (assumes CSV cleaned). Returns array of objects.
function parseCSV(text, sep=';'){
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length>0);
  if(lines.length===0) return [];
  const headers = lines[0].split(sep).map(h=>h.trim());
  const data = [];
  for(let i=1;i<lines.length;i++){
    const row = lines[i].split(sep);
    // if row length < headers, pad
    while(row.length < headers.length) row.push('');
    const obj = {};
    for(let j=0;j<headers.length;j++){
      obj[headers[j]] = row[j] ? row[j].trim() : '';
    }
    data.push(obj);
  }
  return data;
}

// fetch a CSV and parse
async function fetchCSV(path){
  const r = await fetch(path);
  if(!r.ok) throw new Error(`Failed to fetch ${path} — ${r.status}`);
  const txt = await r.text();
  return parseCSV(txt,';');
}

async function loadAllData(){
  try{
    addLog('Loading cleaned CSV data...');
    const [ints, its, us] = await Promise.all([
      fetchCSV('data/processed/interactions_clean.csv'),
      fetchCSV('data/processed/items_clean.csv'),
      fetchCSV('data/processed/users_clean.csv')
    ]);
    interactions = ints;
    items = its;
    users = us;
    addLog(`Loaded CSVs: interactions=${interactions.length}, items=${items.length}, users=${users.length}`);
    // Precompute dataset stats for normalization
    computeDatasetStats();
    return true;
  } catch(err){
    console.error(err);
    addLog('Error loading CSVs: ' + err.message);
    return false;
  }
}

// For EDA / normalization
let globalMaxRating = 0;
let globalMinPrice = Number.POSITIVE_INFINITY;
let globalMaxPrice = 0;
function computeDatasetStats(){
  globalMaxRating = 0;
  globalMinPrice = Number.POSITIVE_INFINITY;
  globalMaxPrice = 0;
  interactions.forEach(i=>{
    const r = parseFloat(i.rating) || 0;
    if(r > globalMaxRating) globalMaxRating = r;
  });
  items.forEach(it=>{
    const p = parseFloat(it.price) || 0;
    if(p < globalMinPrice) globalMinPrice = p;
    if(p > globalMaxPrice) globalMaxPrice = p;
  });
  if(!isFinite(globalMinPrice)) globalMinPrice = 0;
  addLog(`Data stats: maxRating=${globalMaxRating}, minPrice=${globalMinPrice}, maxPrice=${globalMaxPrice}`);
}

// Exported for app
// interactions, items, users, embeddings variables are global in window scope via this file
