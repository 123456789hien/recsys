// data.js - load local u.item and u.data (placed in same folder)
// Exposes: loadData(), parseItemData(text), parseRatingData(text), and variables moviesMap, ratings, numUsers, numMovies

let moviesMap = {};
let ratings = [];
let numUsers = 0;
let numMovies = 0;

function parseItemData(text) {
  moviesMap = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  for (const line of lines) {
    const parts = line.split('|');
    const id = parseInt(parts[0], 10);
    const title = parts[1] ? parts[1].trim() : `Movie ${id}`;
    if (!Number.isNaN(id)) moviesMap[id] = title;
  }
  numMovies = Object.keys(moviesMap).length;
  console.log('parseItemData -> numMovies:', numMovies);
}

function parseRatingData(text) {
  ratings = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const userSet = new Set();
  const movieSet = new Set();

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const userId = parseInt(parts[0], 10);
    const movieId = parseInt(parts[1], 10);
    const rating = parseFloat(parts[2]);
    if (Number.isNaN(userId) || Number.isNaN(movieId) || Number.isNaN(rating)) continue;
    ratings.push({ userId, movieId, rating });
    userSet.add(userId);
    movieSet.add(movieId);
  }
  numUsers = userSet.size ? Math.max(...userSet) : 0;
  if (numMovies === 0) numMovies = movieSet.size ? Math.max(...movieSet) : 0;
  console.log('parseRatingData -> ratings:', ratings.length, 'numUsers:', numUsers, 'numMovies:', numMovies);
}

/**
 * loadData() - local version
 * Must be served by HTTP server (python -m http.server).
 */
async function loadData() {
  try {
    const itemResp = await fetch('u.item');
    if (!itemResp.ok) throw new Error(`Failed to fetch u.item (HTTP ${itemResp.status})`);
    const itemText = await itemResp.text();
    parseItemData(itemText);

    const dataResp = await fetch('u.data');
    if (!dataResp.ok) throw new Error(`Failed to fetch u.data (HTTP ${dataResp.status})`);
    const dataText = await dataResp.text();
    parseRatingData(dataText);

    if (!ratings.length) throw new Error('No ratings parsed from u.data.');

    return { numUsers, numMovies, numRatings: ratings.length, moviesMap };
  } catch (err) {
    console.error('loadData error:', err);
    throw err;
  }
}
