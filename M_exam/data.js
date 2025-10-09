// Global data variables
let users = [];
let items = [];
let interactions = [];
let embeddings = {}; // precomputed embeddings

// Load all cleaned CSVs
async function loadData() {
    await Promise.all([
        loadCSV('data/processed/users_clean.csv', parseUsers),
        loadCSV('data/processed/items_clean.csv', parseItems),
        loadCSV('data/processed/interactions_clean.csv', parseInteractions),
        loadJSON('data/processed/item_embeddings.json', data => embeddings = data)
    ]);
    addNote("✅ Data loaded and parsed successfully");
}

// Generic CSV loader
async function loadCSV(path, parser) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Failed to load ${path}`);
    const text = await resp.text();
    parser(text);
}

// JSON loader
async function loadJSON(path, callback) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Failed to load ${path}`);
    const json = await resp.json();
    callback(json);
}

// Parse functions
function parseUsers(text) {
    const lines = text.trim().split('\n').slice(1);
    users = lines.map(l => {
        const [user_id, location] = l.split(';');
        return { user_id, location };
    });
}

function parseItems(text) {
    const lines = text.trim().split('\n').slice(1);
    items = lines.map(l => {
        const [item_id, name, price] = l.split(';');
        return { item_id, name, price: parseFloat(price) };
    });
}

function parseInteractions(text) {
    const lines = text.trim().split('\n').slice(1);
    interactions = lines.map(l => {
        const [user_id, item_id, timestamp, event_type, rating] = l.split(';');
        return { user_id, item_id, timestamp, event_type, rating: parseFloat(rating) };
    });
}
