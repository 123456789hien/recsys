let interactions = [];
let items = [];
let users = [];
let embeddings = {}; // precomputed embeddings

async function loadCSV(filePath, delimiter=';') {
    const res = await fetch(filePath);
    if(!res.ok) throw new Error(`Failed to fetch ${filePath}`);
    const text = await res.text();
    const lines = text.trim().split('\n');
    const header = lines.shift().split(delimiter);
    return lines.map(line => {
        const cols = line.split(delimiter);
        let obj = {};
        header.forEach((h,i)=>obj[h.trim()] = cols[i].trim());
        return obj;
    });
}

async function loadData() {
    try {
        interactions = await loadCSV('data/processed/interactions_clean.csv');
        items = await loadCSV('data/processed/items_clean.csv');
        users = await loadCSV('data/processed/users_clean.csv');
        console.log('✅ CSV Data Loaded');
        return true;
    } catch(err) {
        console.error('❌ Failed to load CSV data', err);
        return false;
    }
}

function filterUsersByLocation(location) {
    if(location==='All') return users;
    return users.filter(u=>u.location===location);
}

function getUserHistory(userId) {
    return interactions.filter(i=>i.user_id===userId);
}

function downloadEmbeddingsTemplate() {
    const template = {};
    items.forEach(it=>template[it.item_id] = Array(16).fill(0));
    const blob = new Blob([JSON.stringify(template, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'item_embeddings_template.json';
    a.click();
}

function loadEmbeddingsFile(file) {
    return new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = e=>{
            embeddings = JSON.parse(e.target.result);
            resolve();
        };
        reader.onerror = err=>reject(err);
        reader.readAsText(file);
    });
}
