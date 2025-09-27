/* script.js — giống bản trước, chỉ tinh chỉnh message hiển thị */

let model = null;
let _loadedMeta = null;

function setStatus(msg) {
  document.getElementById('result').textContent = msg;
}

function populateDropdowns() {
  const userSelect = document.getElementById('user-select');
  const movieSelect = document.getElementById('movie-select');
  userSelect.innerHTML = '';
  movieSelect.innerHTML = '';

  for (let u = 1; u <= _loadedMeta.numUsers; u++) {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = `User ${u}`;
    userSelect.appendChild(opt);
  }
  for (let m = 1; m <= _loadedMeta.numMovies; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = _loadedMeta.moviesMap[m] ? `${m} — ${_loadedMeta.moviesMap[m]}` : `Movie ${m}`;
    movieSelect.appendChild(opt);
  }
}

function createModel(numUsers, numMovies, latentDim = 20) {
  const userInput = tf.input({ shape: [1], name: 'userInput', dtype: 'int32' });
  const movieInput = tf.input({ shape: [1], name: 'movieInput', dtype: 'int32' });

  const userEmbeddingLayer = tf.layers.embedding({ inputDim: numUsers + 1, outputDim: latentDim, inputLength: 1 });
  const movieEmbeddingLayer = tf.layers.embedding({ inputDim: numMovies + 1, outputDim: latentDim, inputLength: 1 });

  const userBiasLayer = tf.layers.embedding({ inputDim: numUsers + 1, outputDim: 1, inputLength: 1 });
  const movieBiasLayer = tf.layers.embedding({ inputDim: numMovies + 1, outputDim: 1, inputLength: 1 });

  const userVec = tf.layers.flatten().apply(userEmbeddingLayer.apply(userInput));
  const movieVec = tf.layers.flatten().apply(movieEmbeddingLayer.apply(movieInput));
  const dot = tf.layers.dot({ axes: -1 }).apply([userVec, movieVec]);

  const uBias = tf.layers.flatten().apply(userBiasLayer.apply(userInput));
  const mBias = tf.layers.flatten().apply(movieBiasLayer.apply(movieInput));

  const concat = tf.layers.concatenate().apply([dot, uBias, mBias]);
  const prediction = tf.layers.dense({ units: 1, useBias: true }).apply(concat);

  return tf.model({ inputs: [userInput, movieInput], outputs: prediction });
}

async function trainModel() {
  setStatus('Đang tạo mô hình...');
  model = createModel(_loadedMeta.numUsers, _loadedMeta.numMovies);
  model.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });

  const shuffled = tf.util.shuffle(ratings.slice());
  const usersArr = new Int32Array(shuffled.length);
  const moviesArr = new Int32Array(shuffled.length);
  const labelsArr = new Float32Array(shuffled.length);

  for (let i = 0; i < shuffled.length; i++) {
    usersArr[i] = shuffled[i].userId;
    moviesArr[i] = shuffled[i].movieId;
    labelsArr[i] = shuffled[i].rating;
  }

  const userTensor = tf.tensor2d(usersArr, [usersArr.length, 1], 'int32');
  const movieTensor = tf.tensor2d(moviesArr, [moviesArr.length, 1], 'int32');
  const labelTensor = tf.tensor2d(labelsArr, [labelsArr.length, 1], 'float32');

  setStatus('Đang huấn luyện mô hình với dữ liệu cục bộ...');
  await model.fit({ userInput: userTensor, movieInput: movieTensor }, labelTensor, {
    epochs: 8,
    batchSize: 64,
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        setStatus(`Epoch ${epoch + 1}/8 — loss: ${logs.loss.toFixed(4)}`);
        await tf.nextFrame();
      }
    }
  });

  userTensor.dispose();
  movieTensor.dispose();
  labelTensor.dispose();

  setStatus('Huấn luyện xong! Hãy chọn user & movie và bấm Predict.');
}

async function predictRating() {
  if (!model) return setStatus('Mô hình chưa sẵn sàng.');
  const userId = parseInt(document.getElementById('user-select').value, 10);
  const movieId = parseInt(document.getElementById('movie-select').value, 10);
  setStatus(`Đang dự đoán rating cho User ${userId}, Movie ${movieId}...`);

  const uTensor = tf.tensor2d([userId], [1, 1], 'int32');
  const mTensor = tf.tensor2d([movieId], [1, 1], 'int32');
  const out = model.predict({ userInput: uTensor, movieInput: mTensor });
  const outData = await out.data();
  let pred = Math.min(5, Math.max(1, outData[0]));
  setStatus(`Kết quả dự đoán: ${pred.toFixed(2)} / 5`);
  uTensor.dispose(); mTensor.dispose(); out.dispose();
}

window.onload = async function () {
  document.getElementById('predict-btn').addEventListener('click', predictRating);
  try {
    setStatus('Đang tải u.item & u.data từ thư mục hiện tại...');
    _loadedMeta = await loadData();
    populateDropdowns();
    await trainModel();
  } catch (err) {
    console.error(err);
    setStatus('Lỗi đọc dữ liệu. Hãy chắc rằng u.item và u.data nằm cùng thư mục với index.html và mở bằng HTTP server.');
  }
};
