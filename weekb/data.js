let movies = {};
let ratings = [];

// Parse u.item
itemsText.split('\n').forEach(line => {
  const parts = line.split('|');
  if (parts.length > 1) {
    const id = parts[0];
    const title = parts[1];
    movies[id] = { id, title };
  }
});

// Parse u.data
dataText.split('\n').forEach(line => {
  const parts = line.split('\t');
  if (parts.length > 2) {
    ratings.push({ user: parts[0], movie: parts[1], rating: parseInt(parts[2]) });
  }
});

// Fill dropdown
window.onload = function() {
  const select = document.getElementById('movieSelect');
  Object.values(movies).slice(0, 200).forEach(m => { // limit 200 phim
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = m.title;
    select.appendChild(option);
  });
};
