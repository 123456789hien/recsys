// ========================
// data.js - Handles data loading & parsing
// ========================

let numUsers = 0;
let numMovies = 0;
let movies = [];      // {origId, id, title}
let ratings = [];     // {userId, movieId, rating}

// Map for original to new id
const userIdMap = new Map();
const movieIdMap = new Map();

// ------------------------
// Load and parse
// ------------------------
async function loadData() {
  console.log("Loading u.item...");
  const itemText = await fetch("u.item").then(r => r.text());
  parseItemData(itemText);

  console.log("Loading u.data...");
  const dataText = await fetch("u.data").then(r => r.text());
  parseRatingData(dataText);
}

// ------------------------
// Parse u.item
// ------------------------
function parseItemData(text) {
  const lines = text.trim().split("\n");
  let movieIndex = 0;
  movies = lines.map(line => {
    const parts = line.split("|");
    const origId = parseInt(parts[0]);
    if (!movieIdMap.has(origId)) {
      movieIdMap.set(origId, movieIndex++);
    }
    return { origId, id: movieIdMap.get(origId), title: parts[1] };
  });
  numMovies = movieIndex;
  console.log(`Parsed ${numMovies} movies`);
}

// ------------------------
// Parse u.data
// ------------------------
function parseRatingData(text) {
  const lines = text.trim().split("\n");
  let userIndex = 0;

  ratings = lines.map(line => {
    const [u, m, r] = line.split("\t");
    const origUser = parseInt(u);
    const origMovie = parseInt(m);
    // map user
    if (!userIdMap.has(origUser)) {
      userIdMap.set(origUser, userIndex++);
    }
    const uid = userIdMap.get(origUser);
    const mid = movieIdMap.get(origMovie);
    return { userId: uid, movieId: mid, rating: parseFloat(r) };
  });

  numUsers = userIdMap.size;
  console.log(`Parsed ${ratings.length} ratings from ${numUsers} users`);
}
