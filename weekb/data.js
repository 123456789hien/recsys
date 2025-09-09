**data.js**
```javascript
// Load dataset files (u.item and u.data must be in same folder)
let movies = {};
let ratings = [];


async function loadData() {
const itemsText = await fetch('u.item').then(res => res.text());
const dataText = await fetch('u.data').then(res => res.text());


// Parse u.item (movie list)
itemsText.split('\n').forEach(line => {
const parts = line.split('|');
if (parts.length > 1) {
const id = parts[0];
const title = parts[1];
movies[id] = { id, title };
}
});


// Parse u.data (ratings)
dataText.split('\n').forEach(line => {
const parts = line.split('\t');
if (parts.length > 2) {
ratings.push({ user: parts[0], movie: parts[1], rating: parseInt(parts[2]) });
}
});


// Fill dropdown
const select = document.getElementById('movieSelect');
Object.values(movies).slice(0, 200).forEach(m => { // limit for performance
const option = document.createElement('option');
option.value = m.id;
option.textContent = m.title;
select.appendChild(option);
});
}


loadData();
```


---
