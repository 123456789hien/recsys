/* data.js
   Responsible for loading and parsing MovieLens 100K files (u.item and u.data).
   Exposes global variables used by script.js:
     - movies: object mapping movieId -> title
     - ratings: array of { userId, movieId, rating }
     - numUsers, numMovies
*/

let movies = {};    // { movieId: title }
let ratings = [];   // [ { userId, movieId, rating }, ... ]
let numUsers = 0;
let numMovies = 0;

/**
 * loadData()
 * Fetches 'u.item' and 'u.data' from the same folder as index.html.
 * Throws an Error if fetch fails.
 */
async function loadData() {
  try {
    // Load items
    const itemResp = await fetch('u.item');
    if (!itemResp.ok) throw new Error(`Failed to fetch u.item (HTTP ${itemResp.status})`);
    const itemText = await itemResp.text();
    parseItemData(itemText);

    // Load ratings
    const dataResp = await fetch('u.data');
    if (!dataResp.ok) throw new Error(`Failed to fetch u.data (HTTP ${dataResp.status})`);
    const dataText = await dataResp.text();
    parseRatingData(dataText);

    // Final sanity
    if (!Object.keys(movies).length) throw new Error('No movies parsed from u.item');
    if (!ratings.length) throw new Error('No ratings parsed from u.data');

    console.log(`Loaded ${Object.keys(movies).length} movies and ${ratings.length} ratings from ${numUsers} users`);
    return { movies, ratings, numUsers, numMovies };
  } catch (err) {
    console.error('loadData error:', err);
    throw err;
  }
}

/**
 * parseItemData(text)
 * Parses u.item (pipe-separated). Keeps movie id and title.
 */
function parseItemData(text) {
  movies = {};
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('|');
    if (parts.length < 2) continue;
    const id = parseInt(parts[0], 10);
    const title = parts[1].trim();
    if (!Number.isNaN(id)) movies[id] = title;
  }
  numMovies = Object.keys(movies).length;
  console.log(`Parsed ${numMovies} movies`);
}

/**
 * parseRatingData(text)
 * Parses u.data (tab-separated): userId \t movieId \t rating \t timestamp
 */
function parseRatingData(text) {
  ratings = [];
  const userSet = new Set();
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const userId = parseInt(parts[0], 10);
    const movieId = parseInt(parts[1], 10);
    const rating = parseFloat(parts[2]);
    if (Number.isNaN(userId) || Number.isNaN(movieId) || Number.isNaN(rating)) continue;
    ratings.push({ userId, movieId, rating });
    userSet.add(userId);
  }
  numUsers = userSet.size;
  // If numMovies wasn't set from u.item, derive from ratings
  if (!numMovies) {
    const movieSet = new Set(ratings.map(r => r.movieId));
    numMovies = movieSet.size;
  }
  console.log(`Parsed ${ratings.length} ratings from ${numUsers} users`);
}
