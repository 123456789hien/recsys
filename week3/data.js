// Global variables
let movies = [];
let ratings = [];
let numUsers = 0;
let numMovies = 0;

async function loadData() {
  try {
    // Load movies
    const movieText = await fetch('u.item').then(r => r.text());
    movies = parseItemData(movieText);
    numMovies = movies.length;

    // Load ratings
    const ratingText = await fetch('u.data').then(r => r.text());
    ratings = parseRatingData(ratingText);

    const uniqueUsers = new Set(ratings.map(r => r.userId));
    numUsers = uniqueUsers.size;

    console.log(`Loaded ${numMovies} movies and ${ratings.length} ratings from ${numUsers} users`);
  } catch (err) {
    console.error('Error loading data:', err);
    throw err;
  }
}

function parseItemData(text) {
  const lines = text.split('\n');
  const data = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split('|');
    const id = parseInt(parts[0]);
    let title = parts[1];
    let year = null;

    const match = parts[1].match(/(.+)\s+\((\d{4})\)$/);
    if (match) {
      title = match[1].trim();
      year = parseInt(match[2]);
    }

    data.push({ id, title, year });
  }
  return data;
}

function parseRatingData(text) {
  const lines = text.split('\n');
  const data = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const [u, m, r] = line.split('\t');
    data.push({ userId: parseInt(u), movieId: parseInt(m), rating: parseFloat(r) });
  }
  return data;
}
