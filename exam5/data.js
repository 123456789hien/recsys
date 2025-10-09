let users=[], items=[], interactions=[];
let filteredUsers=[];
let userItemMap={};

// Load processed CSVs
async function loadData() {
    try {
        addNote("Loading users...");
        const usersText = await fetch("data/processed/users_clean.csv").then(r=>r.text());
        parseUsers(usersText);
        addNote(`Loaded ${users.length} users.`);

        addNote("Loading items...");
        const itemsText = await fetch("data/processed/items_clean.csv").then(r=>r.text());
        parseItems(itemsText);
        addNote(`Loaded ${items.length} items.`);

        addNote("Loading interactions...");
        const interactionsText = await fetch("data/processed/interactions_clean.csv").then(r=>r.text());
        parseInteractions(interactionsText);
        addNote(`Loaded ${interactions.length} interactions.`);

        buildUserItemMap();
        populateLocationFilter();

    } catch(err) {
        addNote("Error loading data: " + err);
        console.error(err);
    }
}

function parseUsers(text){
    const lines = text.split(/\r?\n/).slice(1);
    users = lines.filter(l=>l).map(l=>{
        const [user_id, location] = l.split(/\s*,\s*/);
        return {user_id, location};
    });
    filteredUsers=[...users];
}

function parseItems(text){
    const lines = text.split(/\r?\n/).slice(1);
    items = lines.filter(l=>l).map(l=>{
        const [item_id, name, price] = l.split(/\s*,\s*/);
        return {item_id, name, price:parseFloat(price)};
    });
}

function parseInteractions(text){
    const lines = text.split(/\r?\n/).slice(1);
    interactions = lines.filter(l=>l).map(l=>{
        const [user_id,item_id,timestamp,event_type,rating] = l.split(/\s*,\s*/);
        return {user_id,item_id,timestamp,event_type,rating:parseFloat(rating)};
    });
}

function buildUserItemMap(){
    userItemMap = {};
    interactions.forEach(i=>{
        if(!userItemMap[i.user_id]) userItemMap[i.user_id]={};
        userItemMap[i.user_id][i.item_id] = i.rating || 0;
    });
}

function populateLocationFilter(){
    const locSelect = document.getElementById("locationFilter");
    const locs = Array.from(new Set(users.map(u=>u.location))).sort();
    locSelect.innerHTML = "<option value='all'>All Locations</option>";
    locs.forEach(loc=>{
        const opt=document.createElement("option");
        opt.value=loc;
        opt.innerText=loc;
        locSelect.appendChild(opt);
    });
}
