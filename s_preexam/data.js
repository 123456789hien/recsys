// data.js
// Robust loader + parser for CSV and optional embeddings JSON.
// Exposes: users[], items[], interactions[], embeddings (item/user)

let users = [];
let items = [];
let interactions = [];
let embeddings = { item_embeddings: null, user_embeddings: null };

// Try multiple candidate paths to avoid 404s
const CANDIDATE_BASES = [
  "data/processed/",
  "data/",
  "./data/processed/",
  "./data/"
];

async function tryFetchTextMulti(filename){
  for(const base of CANDIDATE_BASES){
    const path = base + filename;
    try{
      const r = await fetch(path);
      if(r.ok){ const txt = await r.text(); return {text:txt, path}; }
    }catch(e){ /* continue */ }
  }
  return null;
}

async function tryFetchJSONMulti(filename){
  for(const base of CANDIDATE_BASES){
    const path = base + filename;
    try{
      const r = await fetch(path);
      if(r.ok){ const j = await r.json(); return {json:j, path}; }
    }catch(e){ /* continue */ }
  }
  return null;
}

// auto-load attempt (called on page load or when user clicks auto-load)
async function autoLoadAll(){
  // users
  const ures = await tryFetchTextMulti("users_clean.csv");
  if(ures){ parseUsersCSV(ures.text); document.getElementById("st-users").innerText = `Users: loaded (${users.length}) [${ures.path}]`; }
  // items
  const ires = await tryFetchTextMulti("items_clean.csv");
  if(ires){ parseItemsCSV(ires.text); document.getElementById("st-items").innerText = `Items: loaded (${items.length}) [${ires.path}]`; }
  // interactions
  const xres = await tryFetchTextMulti("interactions_clean.csv");
  if(xres){ parseInteractionsCSV(xres.text); document.getElementById("st-inter").innerText = `Interactions: loaded (${interactions.length}) [${xres.path}]`; }

  // embeddings json try
  const jres = await tryFetchJSONMulti("item_embeddings.json") || await tryFetchJSONMulti("embeddings.json");
  if(jres){
    const j = jres.json;
    embeddings.item_embeddings = j.item_embeddings || j.itemEmbeddings || j.items || j;
    embeddings.user_embeddings = j.user_embeddings || j.userEmbeddings || null;
    document.getElementById("st-emb").innerText = `Embeddings: loaded [${jres.path}]`;
  }
}

// robust CSV parsing: try header-based parse, fallback to position parsing
function splitLine(line){
  // allow ; or , or tab separated
  return line.split(/;|,|\t/).map(s=>s.trim());
}

function parseUsersCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=="");
  let start = 0;
  if(lines[0].toLowerCase().includes("user") || lines[0].toLowerCase().includes("customer")) start = 1;
  users = [];
  for(let i=start;i<lines.length;i++){
    const cols = splitLine(lines[i]);
    if(cols.length===0) continue;
    const user_id = String(cols[0]);
    const location = cols[1] || "";
    users.push({ user_id, location });
  }
}

function parseItemsCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=="");
  let start = 0;
  if(lines[0].toLowerCase().includes("item") || lines[0].toLowerCase().includes("stockcode")) start = 1;
  items = [];
  for(let i=start;i<lines.length;i++){
    const cols = splitLine(lines[i]);
    if(cols.length<2) continue;
    const item_id = String(cols[0]);
    const name = cols[1] || "";
    const price = parseFloat(cols[2] || "0") || 0;
    items.push({ item_id, name, price });
  }
}

function parseInteractionsCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=="");
  let start = 0;
  if(lines[0].toLowerCase().includes("user") && lines[0].toLowerCase().includes("item")) start = 1;
  interactions = [];
  for(let i=start;i<lines.length;i++){
    const cols = splitLine(lines[i]);
    if(cols.length<2) continue;
    const user_id = String(cols[0]);
    const item_id = String(cols[1]);
    const timestamp = cols[2] || "";
    const event_type = cols[3] || "";
    const rating = parseFloat(cols[4] || "0") || 0;
    interactions.push({ user_id, item_id, timestamp, event_type, rating });
  }
}

// helper for file uploads (File -> parse using PapaParse for big files)
function parseCSVFile(file, kind){
  return new Promise((resolve,reject)=>{
    Papa.parse(file, {
      header: true, skipEmptyLines: true, worker: true,
      complete: (res)=>{
        // reserialize if headers present
        const data = res.data;
        // convert array of objects to CSV string to reuse parsers
        const csv = Papa.unparse(data);
        if(kind==='users') parseUsersCSV(csv);
        else if(kind==='items') parseItemsCSV(csv);
        else parseInteractionsCSV(csv);
        resolve();
      },
      error: (err)=> reject(err)
    });
  });
}

window.dataAPI = {
  autoLoadAll,
  parseCSVFile,
  parseUsersCSV,
  parseItemsCSV,
  parseInteractionsCSV,
  usersArr: ()=>users,
  itemsArr: ()=>items,
  interactionsArr: ()=>interactions,
  embeddingsObj: ()=>embeddings
};
