// ========================
// data.js
// Handles loading and parsing MovieLens data
// ========================

// Global variables to share with script.js
let numUsers = 0;
let numMovies = 0;
let movies = [];      // {id, title}
let ratings = [];     // {userId, movieId, rating}

// ------------------------
// Load both u.item and u.data
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
// Format: movieId|title|releaseDate|...
// ------------------------
function parseItemData(text) {
  const lines = text.trim().split("\n");
  movies = lines.map(line => {
    const parts = line.split("|");
    return { id: parseInt(parts[0]), title: parts[1] };
  });
  numMovies = movies.length;
  console.log(`Parsed ${numMovies} movies`);
}

// ------------------------
// Parse u.data
// Format: userId \t movieId \t rating \t timestamp
// ------------------------
function parseRatingData(text) {
  const lines = text.trim().split("\n");
  ratings = lines.map(line => {
    const [u, m, r] = line.split("\t");
    return { userId: parseInt(u), movieId: parseInt(m), rating: parseFloat(r) };
  });
  numUsers = Math.max(...ratings.map(r => r.userId));
  console.log(`Parsed ${ratings.length} ratings from ${numUsers} users`);
}
