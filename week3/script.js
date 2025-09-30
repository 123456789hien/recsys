/* script.js
   Main application: create model, train in browser, predict
   - Uses globals from data.js: movies (object), ratings (array), numUsers, numMovies
   - Updates #status per epoch and shows final "Model training completed successfully!"
*/

// Global trained model
let model = null;
let isTraining = false;

// Initialization
window.onload = async function () {
  try {
    updateStatus('Loading MovieLens data...');
    await loadData(); // from data.js

    // populate dropdowns AFTER data is loaded
    populateUserDropdown();
    populateMovieDropdown();

    // start training
    updateStatus('Data loaded. Training model...');
    await trainModel(); // this will update status per epoch
  } catch (err) {
    console.error('Initialization error:', err);
    updateStatus('Error initializing application: ' + err.message, true);
  }
};

// Populate user select (IDs are 1..numUsers)
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

// Populate movie select using movies object (movieId -> title)
function populateMovieDropdown() {
  const movieSelect = document.getElementById('movie-select');
  movieSelect.innerHTML = '';
  // movies is object; iterate numeric keys in ascending order
  const ids = Object.keys(movies).map(x => parseInt(x, 10)).sort((a, b) => a - b);
  for (const id of ids) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = movies[id] || `Movie ${id}`;
    movieSelect.appendChild(opt);
  }
}

// Create Matrix Factorization model
function createModel(numUsersLocal, numMoviesLocal, latentDim = 20) {
  // Inputs
  const userInput = tf.input({ shape: [1], name: 'userInput', dtype: 'int32' });
  const movieInput = tf.input({ shape: [1], name: 'movieInput', dtype: 'int32' });

  // Embeddings: inputDim must be maxId + 1 (we allow 1-based ids -> inputDim = maxId + 1)
  const userEmbedding = tf.layers.embedding({
    inputDim: numUsersLocal + 1,
    outputDim: latentDim,
    inputLength: 1,
    name: 'userEmbedding'
  }).apply(userInput);

  const movieEmbedding = tf.layers.embedding({
    inputDim: numMoviesLocal + 1,
    outputDim: latentDim,
    inputLength: 1,
    name: 'movieEmbedding'
  }).apply(movieInput);

  // Flatten embeddings
  const userVec = tf.layers.flatten().apply(userEmbedding);
  const movieVec = tf.layers.flatten().apply(movieEmbedding);

  // Dot product and optional bias (simple dot here)
  const dot = tf.layers.dot({ axes: 1 }).apply([userVec, movieVec]);
  const output = tf.layers.dense({ units: 1, useBias: true }).apply(dot);

  const mfModel = tf.model({ inputs: [userInput, movieInput], outputs: output });
  return mfModel;
}

// Train model and update UI per epoch
async function trainModel() {
  try {
    isTraining = true;
    document.getElementById('predict-btn').disabled = true;

    // Create model with correct dims
    model = createModel(numUsers, numMovies, 20);

    // Compile
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    // Prepare tensors (keep 1-based ids to fit embedding inputDim)
    const userIds = new Int32Array(ratings.length);
    const movieIds = new Int32Array(ratings.length);
    const ratingVals = new Float32Array(ratings.length);
    for (let i = 0; i < ratings.length; i++) {
      userIds[i] = ratings[i].userId;
      movieIds[i] = ratings[i].movieId;
      ratingVals[i] = ratings[i].rating;
    }

    const userTensor = tf.tensor2d(userIds, [ratings.length, 1], 'int32');
    const movieTensor = tf.tensor2d(movieIds, [ratings.length, 1], 'int32');
    const ratingTensor = tf.tensor2d(ratingVals, [ratings.length, 1], 'float32');

    const EPOCHS = 10;
    const BATCH = 64;

    // Clear status area and show training start
    updateStatus(`Training epoch 0/${EPOCHS} - starting...`);

    // Fit with callbacks that update UI per epoch
    await model.fit(
      [userTensor, movieTensor],
      ratingTensor,
      {
        epochs: EPOCHS,
        batchSize: BATCH,
        shuffle: true,
        validationSplit: 0.0,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            // Update status element exactly as required
            updateStatus(`Training epoch ${epoch + 1}/${EPOCHS} - loss: ${logs.loss.toFixed(4)}`);
            // yield to browser so UI updates promptly
            await tf.nextFrame();
          },
          onTrainEnd: async () => {
            // Called when training completes
            updateStatus('Model training completed successfully!');
            isTraining = false;
            document.getElementById('predict-btn').disabled = false;
            // free training tensors
            userTensor.dispose();
            movieTensor.dispose();
            ratingTensor.dispose();
            await tf.nextFrame();
          }
        }
      }
    );
  } catch (err) {
    console.error('Training error:', err);
    updateStatus('Error training model: ' + err.message, true);
    isTraining = false;
    document.getElementById('predict-btn').disabled = true;
  }
}

// Prediction function
async function predictRating() {
  if (isTraining || !model) {
    updateResult('Model is still training or not ready. Please wait...', 'medium');
    return;
  }

  const userId = parseInt(document.getElementById('user-select').value, 10);
  const movieId = parseInt(document.getElementById('movie-select').value, 10);

  if (!userId || !movieId) {
    updateResult('Please select both a user and a movie.', 'medium');
    return;
  }

  try {
    // Build tensors (1-based ids preserved)
    const uT = tf.tensor2d(new Int32Array([userId]), [1, 1], 'int32');
    const mT = tf.tensor2d(new Int32Array([movieId]), [1, 1], 'int32');

    const predTensor = model.predict([uT, mT]);
    const predArr = await predTensor.data();
    const predictedRating = predArr[0];

    // Cleanup
    tf.dispose([uT, mT, predTensor]);

    // Format movie title
    const title = movies[movieId] ? movies[movieId] : `Movie ${movieId}`;

    // Determine class for styling (not required but kept from original)
    let cls = 'medium';
    if (predictedRating >= 4) cls = 'high';
    else if (predictedRating <= 2) cls = 'low';

    updateResult(
      `Predicted rating for User ${userId} on "${title}": <strong>${predictedRating.toFixed(2)}/5</strong>`,
      cls
    );
  } catch (err) {
    console.error('Prediction error:', err);
    updateResult('Error making prediction: ' + err.message, 'low');
  }
}

// UI helper functions (same style as teacher's)
function updateStatus(message, isError = false) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.style.borderLeftColor = isError ? '#e74c3c' : '#3498db';
  statusElement.style.background = isError ? '#fdedec' : '#f8f9fa';
}

function updateResult(message, className = '') {
  const resultElement = document.getElementById('result');
  resultElement.innerHTML = message;
  resultElement.className = `result ${className}`.trim();
}
