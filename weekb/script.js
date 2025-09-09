```javascript
function recommend() {
const selectedMovie = document.getElementById('movieSelect').value;


// Find users who liked this movie
const users = ratings.filter(r => r.movie === selectedMovie && r.rating >= 4).map(r => r.user);


// Find other movies those users also liked
let counts = {};
users.forEach(user => {
ratings.filter(r => r.user === user && r.rating >= 4 && r.movie !== selectedMovie)
.forEach(r => {
counts[r.movie] = (counts[r.movie] || 0) + 1;
});
});


// Sort by frequency
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);


// Pick top 3
const top = sorted.slice(0, 3).map(entry => movies[entry[0]].title);


// Show recommendations
const list = document.getElementById('recommendList');
list.innerHTML = '';
top.forEach(title => {
const li = document.createElement('li');
li.textContent = title;
list.appendChild(li);
});
}
```


---
