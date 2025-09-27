// data.js
// Reads u.item and u.data from the same folder as index.html.

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
  numUsers = Math.max(...userSet);
  if (numMovies === 0) numMovies = Math.max(...movieSet);
}

/**
 * Loads u.item and u.data locally.
 * Requires running this page through a local HTTP server
 * (not file://) to avoid fetch/CORS issues.
 */
async function loadData() {
  const itemResp = await fetch('u.item');
  if (!itemResp.ok) throw new Error(`Cannot load u.item (HTTP ${itemResp.status})`);
  parseItemData(await itemResp.text());

  const dataResp = await fetch('u.data');
  if (!dataResp.ok) throw new Error(`Cannot load u.data (HTTP ${dataResp.status})`);
  parseRatingData(await dataResp.text());

  if (!ratings.length) throw new Error('No rating data found in u.data');

  return { numUsers, numMovies, numRatings: ratings.length, moviesMap };
}
