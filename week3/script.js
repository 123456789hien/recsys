// Global variables
let model;
let isTraining = false;

// ------------------- INIT -------------------
window.onload = async function () {
  try {
    updateStatus('Loading MovieLens data...');
    await loadData();

    populateUserDropdown();
    populateMovieDropdown();

    updateStatus('Data loaded. Training model...');
    await trainModel();
  } catch (err) {
    console.error('Initialization error:', err);
    updateStatus('Error initializing: ' + err.message, true);
  }
};

function populateUserDropdown() {
  const userSelect = document.getElementById('user-select');
  userSelect.innerHTML = '';
  for (let i = 1; i <= numUsers; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `User ${i}`;
    userSelect.appendChild(opt);
  }
}

function populateMovieDropdown() {
  const movieSelect = document.getElementById('movie-select');
  movieSelect.innerHTML = '';
  movies.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.year ? `${m.title} (${m.year})` : m.title;
    movieSelect.appendChild(opt);
  });
}

// ------------------- MODEL -------------------
function createModel(numUsers, numMovies, latentDim = 10) {
  const userInput = tf.input({ shape: [1], name: 'userInput' });
  const movieInput = tf.input({ shape: [1], name: 'movieInput' });

  const userEmbedding = tf.layers.embedding({
    inputDim: numUsers + 1,
    outputDim: latentDim
  }).apply(userInput);

  const movieEmbedding = tf.layers.embedding({
    inputDim: numMovies + 1,
    outputDim: latentDim
  }).apply(movieInput);

  const userVec = tf.layers.flatten().apply(userEmbedding);
  const movieVec = tf.layers.flatten().apply(movieEmbedding);

  const dot = tf.layers.dot({ axes: 1 }).apply([userVec, movieVec]);
  const prediction = tf.layers.reshape({ targetShape: [1] }).apply(dot);

  return tf.model({ inputs: [userInput, movieInput], outputs: prediction });
}

async function trainModel() {
  try {
    isTraining = true;
    document.getElementById('predict-btn').disabled = true;

    model = createModel(numUsers, numMovies, 10);
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    const userTensor = tf.tensor2d(ratings.map(r => r.userId), [ratings.length, 1]);
    const movieTensor = tf.tensor2d(ratings.map(r => r.movieId), [ratings.length, 1]);
    const ratingTensor = tf.tensor2d(ratings.map(r => r.rating), [ratings.length, 1]);

    updateStatus('Training model...');

    await model.fit([userTensor, movieTensor], ratingTensor, {
      epochs: 10,
      batchSize: 64,
      validationSplit: 0.1,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          updateStatus(`Training epoch ${epoch + 1}/10 - loss: ${logs.loss.toFixed(4)}`);
        }
      }
    });

    tf.dispose([userTensor, movieTensor, ratingTensor]);
    updateStatus('Model training completed successfully!');
    document.getElementById('predict-btn').disabled = false;
    isTraining = false;
  } catch (err) {
    console.error('Training error:', err);
    updateStatus('Error training model: ' + err.message, true);
    isTraining = false;
  }
}

// ------------------- PREDICT -------------------
async function predictRating() {
  if (isTraining) {
    updateStatus('Model is still training...');
    return;
  }

  const userId = parseInt(document.getElementById('user-select').value);
  const movieId = parseInt(document.getElementById('movie-select').value);

  const userTensor = tf.tensor2d([[userId]]);
  const movieTensor = tf.tensor2d([[movieId]]);

  const prediction = model.predict([userTensor, movieTensor]);
  const pred = (await prediction.data())[0];

  tf.dispose([userTensor, movieTensor, prediction]);

  const movie = movies.find(m => m.id === movieId);
  const title = movie ? (movie.year ? `${movie.title} (${movie.year})` : movie.title) : movieId;

  document.getElementById('result').innerHTML =
    `Predicted rating for User ${userId} on "${title}": <strong>${pred.toFixed(2)}/5</strong>`;
}

// ------------------- STATUS -------------------
function updateStatus(msg, isErr = false) {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.style.color = isErr ? 'red' : '#d63384';
}
