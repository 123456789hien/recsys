let users = [];
let items = [];
let interactions = [];

async function loadData() {
    try {
        // Load users
        const usersResp = await fetch("data/processed/users_clean.csv");
        const usersText = await usersResp.text();
        parseUsers(usersText);

        // Load items
        const itemsResp = await fetch("data/processed/items_clean.csv");
        const itemsText = await itemsResp.text();
        parseItems(itemsText);

        // Load interactions
        const interResp = await fetch("data/processed/interactions_clean.csv");
        const interText = await interResp.text();
        parseInteractions(interText);

        document.getElementById("status-note").innerText = "✅ Data loaded successfully!";
    } catch (err) {
        console.error(err);
        document.getElementById("status-note").innerText = "❌ Error loading CSV files.";
    }
}

function parseUsers(text) {
    const lines = text.split(/\r?\n/).slice(1);
    users = lines.filter(l=>l.trim()!=="").map(l=>{
        const [user_id, location] = l.split(";");
        return {user_id, location};
    });
}

function parseItems(text) {
    const lines = text.split(/\r?\n/).slice(1);
    items = lines.filter(l=>l.trim()!=="").map(l=>{
        const [item_id, name, price] = l.split(";");
        return {item_id, name, price: parseFloat(price)};
    });
}

function parseInteractions(text) {
    const lines = text.split(/\r?\n/).slice(1);
    interactions = lines.filter(l=>l.trim()!=="").map(l=>{
        const [user_id, item_id, timestamp, event_type, rating] = l.split(";");
        return {user_id, item_id, timestamp, event_type, rating: parseFloat(rating)};
    });
}
