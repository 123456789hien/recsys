/* data.js
   Responsible for loading and parsing u.item and u.data (MovieLens 100K)
   Exposes global variables used by script.js:
     - movies: object mapping movieId (number) -> title (string)
     - ratings: array of { userId, movieId, rating }
     - numUsers, numMovies
*/

// Global exports
let movies = {};    // { movieId: title }
let ratings = [];   // [ { userId, movieId, rating }, ... ]
let numUsers = 0;
let numMovies = 0;

/**
 * loadData()
 * Loads u.item and u.data from the same folder using fetch.
 * Throws if fetch fails.
 */
async function loadData() {
  try {
    // Load u.item
    const itemResp = await fetch('u.item');
    if (!itemResp.ok) throw new Error(`Failed to fetch u.item (HTTP ${itemResp.status})`);
    const itemText = await itemResp.text();
    parseItemData(itemText);

    // Load u.data
    const dataResp = await fetch('u.data');
    if (!dataResp.ok) throw new Error(`Failed to fetch u.data (HTTP ${dataResp.status})`);
    const dataText = await dataResp.text();
    parseRatingData(dataText);

    // Basic sanity checks
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
 * u.item lines are pipe-separated. We keep only id and title.
 */
function parseItemData(text) {
  movies = {};
  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('|');
    // Expect at least id and title
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
 * u.data lines are tab-separated: userId \t movieId \t rating \t timestamp
 * We extract first three columns.
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
  // optional: recompute numMovies if empty above
  if (!numMovies) {
    const movieSet = new Set(ratings.map(r => r.movieId));
    numMovies = movieSet.size;
  }
  console.log(`Parsed ${ratings.length} ratings from ${numUsers} users`);
}
