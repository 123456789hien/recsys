let interactions = [];
let items = [];
let users = [];
let embeddings = {};

async function loadCSV(path) {
    const response = await fetch(path);
    const text = await response.text();
    return text;
}

function parseCSV(text, sep = ";") {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(sep);
    const data = lines.slice(1).map(line => {
        const values = line.split(sep);
        let obj = {};
        headers.forEach((h, i) => obj[h.trim()] = values[i].trim());
        return obj;
    });
    return data;
}

async function loadData() {
    try {
        const [intCSV, itemCSV, userCSV] = await Promise.all([
            loadCSV("data/processed/interactions_clean.csv"),
            loadCSV("data/processed/items_clean.csv"),
            loadCSV("data/processed/users_clean.csv")
        ]);

        interactions = parseCSV(intCSV);
        items = parseCSV(itemCSV);
        users = parseCSV(userCSV);

        console.log("Data loaded:", {interactions, items, users});
        return true;
    } catch (err) {
        console.error("Error loading CSV:", err);
        alert("Failed to load CSV files. Please check paths.");
        return false;
    }
}
