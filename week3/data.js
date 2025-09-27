/* data.js
   Responsibilities:
   - Load MovieLens 100K files (u.item and u.data) via fetch.
   - Parse the item file (u.item) to extract movie id -> title mapping.
   - Parse the rating file (u.data) to extract userId, movieId, rating triples.
   - Expose loadData(), parseItemData(text), parseRatingData(text), and public variables:
       moviesMap  => { movieId (int) : title (string) }
       ratings    => [ { userId: int, movieId: int, rating: float }, ... ]
       numUsers, numMovies
   Implementation notes:
   - MovieLens 100K uses 1-based ids; we'll keep that convention when populating dropdowns,
     but model inputs will be zero-based indices (handled in script.js).
   - If fetch fails (CORS, network), an informative error is thrown and shown to user.
*/

let moviesMap = {};   // movieId (int) -> title (string)
let ratings = [];     // array of {userId, movieId, rating}
let numUsers = 0;
let numMovies = 0;

/**
 * parseItemData(text)
 * Parse u.item format (pipe-separated). Each line like:
 *   movieId|movie title|...
 * We extract the movieId (int) and title (string).
 */
function parseItemData(text) {
  moviesMap = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  for (const line of lines) {
    // u.item sometimes includes '|' inside titles? The canonical file uses '|' separators and the title is the second field.
    // So split on '|' into max 2+ parts and take index 1.
    const parts = line.split('|');
    const id = parseInt(parts[0], 10);
    const title = parts[1] ? parts[1].trim() : `Movie ${id}`;
    if (!Number.isNaN(id)) moviesMap[id] = title;
  }
  // count unique movies parsed
  numMovies = Object.keys(moviesMap).length;
}

/**
 * parseRatingData(text)
 * Parse u.data format (tab-separated): userId \t itemId \t rating \t timestamp
 * We produce an array of objects with numeric fields.
 */
function parseRatingData(text) {
  ratings = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const userSet = new Set();
  const movieSet = new Set();
  for (const line of lines) {
    const parts = line.split(/\s+/); // whitespace-separated
    if (parts.length < 3) continue;
    const userId = parseInt(parts[0], 10);
    const movieId = parseInt(parts[1], 10);
    const rating = parseFloat(parts[2]);
    if (Number.isNaN(userId) || Number.isNaN(movieId) || Number.isNaN(rating)) continue;
    ratings.push({ userId, movieId, rating });
    userSet.add(userId);
    movieSet.add(movieId);
  }
  // The MovieLens 100K dataset often uses contiguous user ids 1..943 and movie ids 1..1682,
  // but we recompute counts from the parsed data for robustness.
  numUsers = Math.max(...Array.from(userSet)) || userSet.size;
  // Note: numUsers computed as max ID so dropdown can list up to the max ID; alternatively use userSet.size.
  // For numMovies, prefer the parsed moviesMap if available:
  if (numMovies === 0) {
    numMovies = Math.max(...Array.from(movieSet)) || movieSet.size;
  }
}

/**
 * loadData()
 * Async function that fetches the u.item and u.data files from the MovieLens 100K official distribution.
 * Returns a Promise resolved when parsing is complete.
 *
 * URLs used (MovieLens 100K raw files):
 *   u.item: https://files.grouplens.org/datasets/movielens/ml-100k/u.item
 *   u.data: https://files.grouplens.org/datasets/movielens/ml-100k/u.data
 *
 * Note on CORS: GroupLens usually allows fetch from browsers, but if your environment blocks cross-origin requests,
 * you'll need to host the files locally or enable CORS.
 */
async function loadData() {
  // Update: using the official GroupLens file URLs for ml-100k.
  const itemUrl = 'https://files.grouplens.org/datasets/movielens/ml-100k/u.item';
  const dataUrl = 'https://files.grouplens.org/datasets/movielens/ml-100k/u.data';

  // Fetch item file
  const itemResp = await fetch(itemUrl);
  if (!itemResp.ok) {
    throw new Error(`Failed to fetch u.item: ${itemResp.status} ${itemResp.statusText}`);
  }
  const itemText = await itemResp.text();
  parseItemData(itemText);

  // Fetch ratings file
  const dataResp = await fetch(dataUrl);
  if (!dataResp.ok) {
    throw new Error(`Failed to fetch u.data: ${dataResp.status} ${dataResp.statusText}`);
  }
  const dataText = await dataResp.text();
  parseRatingData(dataText);

  // Basic sanity checks
  if (!ratings.length) throw new Error('No ratings parsed — check the u.data source or CORS policy.');
  if (!numUsers || !numMovies) {
    // Fallback: compute from ratings
    const users = new Set(ratings.map(r => r.userId));
    const movies = new Set(ratings.map(r => r.movieId));
    numUsers = users.size;
    numMovies = movies.size;
  }

  // Return an object with some metadata for convenience
  return {
    numUsers,
    numMovies,
    numRatings: ratings.length,
    moviesMap,
  };
}
