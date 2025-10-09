// Global arrays
let users = [];
let items = [];
let interactions = [];
let embeddings = null;

// Load CSV to array
async function loadCSV(file, callback) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const headers = lines[0].split(/[;,]/);
  const data = lines.slice(1).map(line => {
    const vals = line.split(/[;,]/);
    let obj = {};
    headers.forEach((h,i) => obj[h.trim()] = vals[i].trim());
    return obj;
  });
  callback(data);
}
