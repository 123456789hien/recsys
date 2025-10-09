let users = [];
let items = [];
let interactions = [];
let itemEmbeddings = {};

async function autoLoadData() {
  try {
    const [usersRes, itemsRes, interRes] = await Promise.all([
      fetch("data/processed/users_clean.csv"),
      fetch("data/processed/items_clean.csv"),
      fetch("data/processed/interactions_clean.csv")
    ]);

    const [usersText, itemsText, interText] = await Promise.all([
      usersRes.text(), itemsRes.text(), interRes.text()
    ]);

    parseUsers(usersText);
    parseItems(itemsText);
    parseInteractions(interText);

    document.getElementById("status-note").innerText = "✅ Data auto-loaded successfully!";
    initializeUI();
  } catch (err) {
    document.getElementById("status-note").innerText = "❌ Error auto-loading data.";
  }
}

function parseUsers(text){
  const lines = text.split(/\r?\n/).slice(1);
  users = lines.filter(l=>l.trim()!=="").map(l=>{
    const [user_id, location] = l.split(";");
    return {user_id, location};
  });
}

function parseItems(text){
  const lines = text.split(/\r?\n/).slice(1);
  items = lines.filter(l=>l.trim()!=="").map(l=>{
    const [item_id, name, price] = l.split(";");
    return {item_id, name, price: parseFloat(price)};
  });
}

function parseInteractions(text){
  const lines = text.split(/\r?\n/).slice(1);
  interactions = lines.filter(l=>l.trim()!=="").map(l=>{
    const [user_id, item_id, timestamp, event_type, rating] = l.split(";");
    return {user_id, item_id, timestamp, event_type, rating: parseFloat(rating)};
  });
}
