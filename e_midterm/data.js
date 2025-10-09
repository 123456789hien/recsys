// Load CSV into arrays
async function loadCSV(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  const text = await res.text();
  const rows = text.trim().split("\n").slice(1);
  const sep = rows[0].includes(";") ? ";" : ",";
  return rows.map(line => {
    const parts = line.split(sep);
    return parts.map(p => p.trim());
  });
}

export async function loadData() {
  const [interactions, items, users] = await Promise.all([
    loadCSV("data/processed/interactions_clean.csv"),
    loadCSV("data/processed/items_clean.csv"),
    loadCSV("data/processed/users_clean.csv")
  ]);

  const interObjs = interactions.map(r => ({
    user_id: r[0], item_id: r[1], timestamp: r[2],
    event_type: r[3], rating: parseFloat(r[4])
  }));
  const itemObjs = items.map(r => ({
    item_id: r[0], name: r[1], price: parseFloat(r[2])
  }));
  const userObjs = users.map(r => ({
    user_id: r[0], location: r[1]
  }));

  return { interObjs, itemObjs, userObjs };
}
