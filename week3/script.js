// script.js - training and prediction logic with TF.js
let model = null;
let meta = null; // { numUsers, numMovies, moviesMap }

const predictBtn = () => document.getElementById('predict-btn');
const retrainBtn = () => document.getElementById('retrain-btn');

function setStatus(msg) {
  const el = document.getElementById('result');
  el.textContent = msg;
  console.log('STATUS:', msg);
}

function enablePredict(enabled = true) {
  const btn = document.getElementById('predict-btn');
  btn.disabled = !enabled;
  if (enabled) btn.classList.remove('disabled');
}

function populateDropdowns() {
  const userSelect = document.getElementById('user-select');
  const movieSelect = document.getElementById('movie-select');
  userSelect.innerHTML = '';
  movieSelect.innerHTML = '';

  // Use max user ID (1-based). Safe guard: limit how many entries we add to dropdown to avoid heavy DOM.
  const maxUsers = meta.numUsers || 943;
  const maxMovies = meta.numMovies || 1682;
  const userLimit = Math.min(maxUsers, 500); // avoid huge dropdowns; if >500, offer first 500
  const movieLimit = Math.min(maxMovies, 800);

  for (let u = 1; u <= userLimit; u++) {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = `User ${u}`;
    userSelect.appendChild(opt);
  }

  for (let m = 1; m <= movieLimit; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = meta.moviesMap[m] ? `${m} — ${meta.moviesMap[m]}` : `Movie ${m}`;
    movieSelect.appendChild(opt);
  }

  if (meta.numUsers > userLimit) {
    const opt = document.createElement('option');
    opt.value = userLimit + 1;
    opt.textContent = `... and ${meta.numUsers - userLimit} more`;
    userSelect.appendChild(opt);
  }
  if (meta.numMovies > movieLimit) {
    const opt = document.createElement('option');
    opt.value = movieLimit + 1;
    opt.textContent = `... and ${meta.numMovies - movieLimit} more`;
    movieSelect.appendChild(opt);
  }
}

function createModel(numUsers, numMovies, latentDim = 20) {
  // Inputs
  const userInput = tf.input({ shape: [1], name: 'userInput', dtype: 'int32' });
  const movieInput = tf.input({ shape: [1], name: 'movieInput', dtype: 'int32' });

  // Embeddings
  const userEmb = tf.layers.embedding({ inputDim: numUsers + 1, outputDim: latentDim, inputLength: 1, name: 'userEmb' });
  const movieEmb = tf.layers.embedding({ inputDim: numMovies + 1, outputDim: latentDim, inputLength: 1, name: 'movieEmb' });

  const userBias = tf.layers.embedding({ inputDim: numUsers + 1, outputDim: 1, inputLength: 1, name: 'userBias' });
  const movieBias = tf.layers.embedding({ inputDim: numMovies + 1, outputDim: 1, inputLength: 1, name: 'movieBias' });

  const uVec = tf.layers.flatten().apply(userEmb.apply(userInput));
  const mVec = tf.layers.flatten().apply(movieEmb.apply(movieInput));
  const dot = tf.layers.dot({ axes: -1 }).apply([uVec, mVec]);

  const uB = tf.layers.flatten().apply(userBias.apply(userInput));
  const mB = tf.layers.flatten().apply(movieBias.apply(movieInput));

  const concat = tf.layers.concatenate().apply([dot, uB, mB]);
  const out = tf.layers.dense({ units: 1, useBias: true, name: 'finalDense' }).apply(concat);

  return tf.model({ inputs: [userInput, movieInput], outputs: out, name: 'mfModel' });
}

async function trainModel(epochs = 8, batchSize = 64) {
  try {
    setStatus('Creating model...');
    model = createModel(meta.numUsers, meta.numMovies, 20);
    model.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });

    setStatus('Preparing tensors...');
    const shuffled = tf.util.shuffle(ratings.slice());
    const n = shuffled.length;
    const usersArr = new Int32Array(n);
    const moviesArr = new Int32Array(n);
    const labelsArr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      usersArr[i] = shuffled[i].userId;
      moviesArr[i] = shuffled[i].movieId;
      labelsArr[i] = shuffled[i].rating;
    }

    const userTensor = tf.tensor2d(usersArr, [n, 1], 'int32');
    const movieTensor = tf.tensor2d(moviesArr, [n, 1], 'int32');
    const labelTensor = tf.tensor2d(labelsArr, [n, 1], 'float32');

    setStatus(`Training model (${epochs} epochs)...`);
    enablePredict(false);
    retrainBtn().style.display = 'none';

    await model.fit({ userInput: userTensor, movieInput: movieTensor }, labelTensor, {
      epochs,
      batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          setStatus(`Epoch ${epoch + 1}/${epochs} — loss: ${logs.loss.toFixed(4)}`);
          await tf.nextFrame();
        }
      }
    });

    userTensor.dispose();
    movieTensor.dispose();
    labelTensor.dispose();

    setStatus('Training complete. Model ready for predictions.');
    enablePredict(true);
    retrainBtn().style.display = 'inline-block';
    console.log('Model summary:'); model.summary();
  } catch (err) {
    console.error('trainModel error:', err);
    setStatus('Training failed: ' + err.message);
    enablePredict(false);
  }
}

async function predictRating() {
  try {
    if (!model) return setStatus('Model not ready. Please wait for training to finish.');
    const userId = parseInt(document.getElementById('user-select').value, 10);
    const movieId = parseInt(document.getElementById('movie-select').value, 10);
    setStatus(`Predicting for User ${userId}, Movie ${movieId} ...`);

    // Ensure valid numbers
    if (!Number.isFinite(userId) || !Number.isFinite(movieId)) {
      return setStatus('Invalid user or movie selection.');
    }

    // Build tensors
    const uTensor = tf.tensor2d(new Int32Array([userId]), [1,1], 'int32');
    const mTensor = tf.tensor2d(new Int32Array([movieId]), [1,1], 'int32');

    const out = model.predict({ userInput: uTensor, movieInput: mTensor });
    const outData = await out.data();
    let pred = outData[0];
    uTensor.dispose(); mTensor.dispose(); out.dispose();

    if (!Number.isFinite(pred)) return setStatus('Prediction is NaN or invalid.');

    pred = Math.min(5, Math.max(1, pred));
    const title = (meta.moviesMap && meta.moviesMap[movieId]) ? ` — ${meta.moviesMap[movieId]}` : '';
    setStatus(`Predicted rating for User ${userId} on Movie ${movieId}${title}: ${pred.toFixed(2)} / 5`);
    console.log('Predicted value:', pred);
  } catch (err) {
    console.error('predictRating error:', err);
    setStatus('Prediction error: ' + err.message);
  }
}

window.onload = async () => {
  document.getElementById('predict-btn').addEventListener('click', predictRating);
  document.getElementById('retrain-btn').addEventListener('click', () => trainModel(8, 64));

  try {
    setStatus('Loading local dataset (u.item & u.data)...');
    meta = await loadData();
    console.log('Loaded meta:', meta);
    populateDropdowns();
    await trainModel(8, 64);
  } catch (err) {
    console.error('Initialization error:', err);
    setStatus('Error loading data or training: ' + err.message + '. Ensure u.item & u.data exist and serve via HTTP.');
    enablePredict(false);
  }
};
