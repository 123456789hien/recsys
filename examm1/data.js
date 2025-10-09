// Data storage arrays
let users = [];
let items = [];
let interactions = [];
let itemEmbeddings = {};

// Helper: parse CSV to array of objects
function parseCSV(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    const headers = lines[0].split(/;|,/);
    const data = lines.slice(1).map(line => {
      const values = line.split(/;|,/);
      const obj = {};
      headers.forEach((h, i) => obj[h.trim()] = values[i].trim());
      return obj;
    });
    callback(data);
  };
  reader.readAsText(file);
}

// Load CSV files
function loadUsers(file) {
  parseCSV(file, data => {
    users = data;
    populateLocationDropdown();
    document.getElementById("noteLoadData").innerText = "✅ Users loaded.";
  });
}

function loadItems(file) {
  parseCSV(file, data => {
    items = data;
    document.getElementById("noteLoadData").innerText += " ✅ Items loaded.";
  });
}

function loadInteractions(file) {
  parseCSV(file, data => {
    interactions = data.map(d => ({
      user_id: d.user_id,
      item_id: d.item_id,
      rating: +d.rating,
      price: +d.price || 0,
      timestamp: d.timestamp
    }));
    document.getElementById("noteLoadData").innerText += " ✅ Interactions loaded.";
  });
}
