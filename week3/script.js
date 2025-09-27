// script.js
// Handles training & prediction with TensorFlow.js

let model = null;
let meta = null;

function setStatus(msg) {
  document.getElementById('result').textContent = msg;
}

function populateDropdowns() {
  const userSelect = document.getElementById('user-select');
  const movieSelect = document.getElementById('movie-select');
  userSelect.innerHTML = '';
  movieSelect.innerHTML = '';

  for (let u = 1; u <= meta.numUsers; u++) {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = `User ${u}`;
    userSelect.appendChild(opt);
  }

  for (let m = 1; m <= meta.numMovies; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = meta.moviesMap[m] ? `${m} — ${meta.moviesMap[m]}` : `Movie ${m}`;
    movieSelect.appendChild(opt);
  }
}

function createModel(numUsers, numMovies, latentDim = 20) {
  const userInput = tf.input({ shape: [1], name: 'userInput', dtype: 'int32' });
  const movieInput = tf.input({ shape: [1], name: 'movieInput', dtype: 'int32' });

  const userEmbedding = tf.layers.embedding({ inputDim: numUsers + 1, outputDim: latentDim, inputLength: 1 });
  const movieEmbedding = tf.layers.embedding({ inputDim: numMovies + 1, outputDim: latentDim, inputLength: 1 });

  const userBias = tf.layers.embedding({ inputDim: numUsers + 1, outputDim: 1, inputLength: 1 });
  const movieBias = tf.layers.embedding({ inputDim: numMovies + 1, outputDim: 1, inputLength: 1 });

  const userVec = tf.layers.flatten().apply(userEmbedding.apply(userInput));
  const movieVec = tf.layers.flatten().apply(movieEmbedding.apply(movieInput));
  const dot = tf.layers.dot({ axes: -1 }).apply([userVec, movieVec]);

  const uBias = tf.layers.flatten().apply(userBias.apply(userInput));
  const mBias = tf.layers.flatten().apply(movieBias.apply(movieInput));

  const concat = tf.layers.concatenate().apply([dot, uBias, mBias]);
  const prediction = tf.layers.dense({ units: 1, useBias: true }).apply(concat);

  return tf.model({ inputs: [userInput, movieInput], outputs: prediction });
}

async function trainModel() {
  setStatus('Building the model...');
  model = createModel(meta.numUsers, meta.numMovies);
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

  setStatus('Training model on local data...');
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

  setStatus('Training complete! Select a user & movie and press Predict.');
}

async function predictRating() {
  if (!model) return setStatus('Model is not ready yet.');
  const userId = parseInt(document.getElementById('user-select').value, 10);
  const movieId = parseInt(document.getElementById('movie-select').value, 10);

  setStatus(`Predicting rating for User ${userId}, Movie ${movieId}...`);

  const uTensor = tf.tensor2d([userId], [1, 1], 'int32');
  const mTensor = tf.tensor2d([movieId], [1, 1], 'int32');
  const out = model.predict({ userInput: uTensor, movieInput: mTensor });
  const outData = await out.data();
  const pred = Math.min(5, Math.max(1, outData[0]));

  setStatus(`Predicted rating: ${pred.toFixed(2)} / 5`);

  uTensor.dispose();
  mTensor.dispose();
  out.dispose();
}

window.onload = async () => {
  document.getElementById('predict-btn').addEventListener('click', predictRating);

  try {
    setStatus('Loading u.item & u.data from local folder...');
    meta = await loadData();
    populateDropdowns();
    await trainModel();
  } catch (err) {
    console.error(err);
    setStatus('Error loading data. Ensure u.item and u.data are in the same folder and open the app via an HTTP server.');
  }
};
