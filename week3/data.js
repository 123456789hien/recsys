/* data.js
   ✅ ĐÃ CHỈNH SỬA: loadData() giờ đọc trực tiếp u.item và u.data từ cùng thư mục với index.html
   Chỉ cần đặt u.item và u.data trong cùng folder, chạy index.html bằng HTTP server (hoặc Live Server).
*/

let moviesMap = {};
let ratings = [];
let numUsers = 0;
let numMovies = 0;

function parseItemData(text) {
  moviesMap = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  for (const line of lines) {
    const parts = line.split('|');
    const id = parseInt(parts[0], 10);
    const title = parts[1] ? parts[1].trim() : `Movie ${id}`;
    if (!Number.isNaN(id)) moviesMap[id] = title;
  }
  numMovies = Object.keys(moviesMap).length;
}

function parseRatingData(text) {
  ratings = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const userSet = new Set();
  const movieSet = new Set();
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const userId = parseInt(parts[0], 10);
    const movieId = parseInt(parts[1], 10);
    const rating = parseFloat(parts[2]);
    if (Number.isNaN(userId) || Number.isNaN(movieId) || Number.isNaN(rating)) continue;
    ratings.push({ userId, movieId, rating });
    userSet.add(userId);
    movieSet.add(movieId);
  }
  numUsers = Math.max(...userSet);
  if (numMovies === 0) numMovies = Math.max(...movieSet);
}

/**
 * loadData() — phiên bản LOCAL
 * Đọc trực tiếp file 'u.item' và 'u.data' từ cùng thư mục.
 * ⚠️ Quan trọng: bạn cần chạy trang web qua HTTP server, không phải mở trực tiếp file://
 * Nếu dùng VSCode, chỉ cần cài Live Server extension, bấm "Go Live".
 */
async function loadData() {
  const itemResp = await fetch('u.item');
  if (!itemResp.ok) throw new Error(`Không thể đọc u.item (HTTP ${itemResp.status})`);
  parseItemData(await itemResp.text());

  const dataResp = await fetch('u.data');
  if (!dataResp.ok) throw new Error(`Không thể đọc u.data (HTTP ${dataResp.status})`);
  parseRatingData(await dataResp.text());

  if (!ratings.length) throw new Error('Không đọc được rating từ u.data');

  return {
    numUsers,
    numMovies,
    numRatings: ratings.length,
    moviesMap,
  };
}
