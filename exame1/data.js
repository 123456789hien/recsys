let interactions = [];
let items = [];
let users = [];
let itemEmbeddings = {};

// Load clean CSV data
async function loadCSV(path) {
  const resp = await fetch(path);
  const text = await resp.text();
  const rows = text.trim().split("\n");
  const headers = rows[0].split(/[;,]/);
  return rows.slice(1).map(row => {
    const cols = row.split(/[;,]/);
    let obj = {};
    headers.forEach((h, i) => obj[h.trim()] = cols[i].trim());
    return obj;
  });
}

async function loadData() {
  interactions = await loadCSV("data/processed/interactions_clean.csv");
  items = await loadCSV("data/processed/items_clean.csv");
  users = await loadCSV("data/processed/users_clean.csv");
  console.log("✅ CSV data loaded");

  populateLocationFilter();
}

function populateLocationFilter() {
  const locSet = new Set(users.map(u => u.location));
  const locFilter = document.getElementById("locationFilter");
  locSet.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locFilter.appendChild(opt);
  });
  document.getElementById("noteLocation").textContent = "✅ Locations loaded";
}
