function recommend() {
  const selectedMovie = document.getElementById('movieSelect').value;

  // Tìm users thích phim này
  const users = ratings
    .filter(r => r.movie === selectedMovie && r.rating >= 4)
    .map(r => r.user);

  // Tìm các phim khác mà những user này thích
  let counts = {};
  users.forEach(user => {
    ratings
      .filter(r => r.user === user && r.rating >= 4 && r.movie !== selectedMovie)
      .forEach(r => {
        counts[r.movie] = (counts[r.movie] || 0) + 1;
      });
  });

  // Sắp xếp theo tần suất
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // Lấy top 3
  const top = sorted.slice(0, 3).map(entry => movies[entry[0]].title);

  // Hiển thị
  const list = document.getElementById('recommendList');
  list.innerHTML = '';
  top.forEach(title => {
    const li = document.createElement('li');
    li.textContent = title;
    list.appendChild(li);
  });
}
