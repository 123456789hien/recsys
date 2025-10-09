// Data arrays
let users = [];
let items = [];
let interactions = [];
let itemEmbeddings = {};

// Load CSV
function loadCSV(file, callback) {
  Papa.parse(file, {
    header: true,
    delimiter: /[,;]+/,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function(results) {
      callback(results.data);
    }
  });
}

// Load Users CSV
document.getElementById("uploadUsers").addEventListener("change", e => {
  loadCSV(e.target.files[0], data => {
    users = data;
    updateLocationButtons();
    updateUserSelect();
    document.getElementById("noteLoadData").innerText = "Users loaded ✅";
  });
});

// Load Items CSV
document.getElementById("uploadItems").addEventListener("change", e => {
  loadCSV(e.target.files[0], data => {
    items = data;
    document.getElementById("noteLoadData").innerText = "Items loaded ✅";
  });
});

// Load Interactions CSV
document.getElementById("uploadInteractions").addEventListener("change", e => {
  loadCSV(e.target.files[0], data => {
    interactions = data;
    document.getElementById("noteLoadData").innerText = "Interactions loaded ✅";
  });
});

// Update Location buttons
function updateLocationButtons() {
  const locations = [...new Set(users.map(u => u.location))];
  const container = document.getElementById("locationButtons");
  container.innerHTML = '';
  const allBtn = document.createElement("button");
  allBtn.innerText = "All Locations";
  allBtn.onclick = () => { updateUserSelect(); document.getElementById("noteFilterUsers").innerText = "Showing all users ✅"; };
  container.appendChild(allBtn);
  locations.forEach(loc => {
    const btn = document.createElement("button");
    btn.innerText = loc;
    btn.onclick = () => { updateUserSelect(loc); document.getElementById("noteFilterUsers").innerText = `Filtered by location: ${loc} ✅`; };
    container.appendChild(btn);
  });
}

// Update User dropdown
function updateUserSelect(location=null) {
  const select = document.getElementById("userSelect");
  select.innerHTML = '<option value="">Select User</option>';
  let filtered = location ? users.filter(u => u.location === location) : users;
  filtered.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.user_id;
    opt.innerText = u.user_id;
    select.appendChild(opt);
  });
}

// Upload embeddings JSON
document.getElementById("uploadEmbeddings").addEventListener("change", e => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = function(event) {
    itemEmbeddings = JSON.parse(event.target.result);
    document.getElementById("noteEmbeddings").innerText = "Embeddings loaded ✅";
  };
  reader.readAsText(file);
});

// Download template embeddings
document.getElementById("downloadTemplate").addEventListener("click", () => {
  const template = {};
  items.forEach(it => { template[it.item_id] = Array(16).fill(0); });
  const blob = new Blob([JSON.stringify(template,null,2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "item_embeddings_template.json";
  a.click();
});
