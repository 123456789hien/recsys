let users = [];
let items = [];
let interactions = [];
let itemEmbeddings = {}; // sẽ upload sau

// CSV Parsing function
function parseCSV(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.trim().split(/\r?\n/);
        const headers = lines[0].split(/[;,]/).map(h => h.trim());
        const data = lines.slice(1).map(line => {
            const values = line.split(/[;,]/).map(v => v.trim());
            let obj = {};
            headers.forEach((h, i) => obj[h] = values[i]);
            return obj;
        });
        callback(data);
    };
    reader.readAsText(file);
}
