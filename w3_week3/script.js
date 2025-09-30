/* script.js
   Main application logic:
   - loads data (via loadData from data.js)
   - populates dropdowns
   - defines and trains a Matrix Factorization model (in-browser with TF.js)
   - updates #result with epoch messages and final success message
   - predicts rating when user clicks Predict
*/

// Global model
let model = null;
let isTraining = false;

// When page loads: load data, populate UI, train model
window.onload = async function() {
  try {
    updateResult('Loading data...');
    await loadData(); // defined in data.js

    // populate dropdowns (after load)
    populateUserDropdown();
    populateMovieDropdown();

    // begin training
    updateResult('Data loaded. Training model...');
    await trainModel(); // shows epoch updates and final success message
  } catch (err) {
    console.error('Initialization error:', err);
    updateResult('Error initializing application: ' + err.message);
  }
};

// Populate users 1..numUsers
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

// Populate movies from movies object (sorted by id)
function populateMovieDropdown() {
  const movieSelect = document.getElementById('movie-select');
  movieSelect.innerHTML = '';
  const ids = Object.keys(movies).map(x => parseInt(x, 10)).sort((a,b) => a-b);
  for (const id of ids) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = movies[id] || `Movie ${id}`;
    movieSelect.appendChild(opt);
  }
}

// Create Matrix Factorization model with embeddings and bias
function createModel(numUsersLocal, numMoviesLocal, latentDim = 20) {
  // Inputs (1-based ids; inputDim = maxId + 1)
  const userInput = tf.input({ shape: [1], name: 'userInput', dtype: 'int32' });
  const movieInput = tf.input({ shape: [1], name: 'movieInput', dtype: 'int32' });

  // Embeddings
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

  // Bias embeddings (optional improvement)
  const userBias = tf.layers.embedding({
    inputDim: numUsersLocal + 1,
    outputDim: 1,
    inputLength: 1,
    name: 'userBias'
  }).apply(userInput);

  const movieBias = tf.layers.embedding({
    inputDim: numMoviesLocal + 1,
    outputDim: 1,
    inputLength: 1,
    name: 'movieBias'
  }).apply(movieInput);

  // Flatten embeddings
  const uVec = tf.layers.flatten().apply(userEmbedding);
  const mVec = tf.layers.flatten().apply(movieEmbedding);
  const uB = tf.layers.flatten().apply(userBias);
  const mB = tf.layers.flatten().apply(movieBias);

  // Dot product
  const dot = tf.layers.dot({ axes: 1 }).apply([uVec, mVec]);

  // Combine dot + biases + global bias via Dense
  const concat = tf.layers.concatenate().apply([dot, uB, mB]);
  const output = tf.layers.dense({ units: 1, useBias: true, name: 'prediction' }).apply(concat);

  const mfModel = tf.model({ inputs: [userInput, movieInput], outputs: output });
  return mfModel;
}

// Train model and update UI per epoch
async function trainModel() {
  try {
    isTraining = true;
    document.getElementById('predict-btn').disabled = true;

    // Create & compile
    model = createModel(numUsers, numMovies, 20);
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    // Prepare tensors (keep 1-based ids)
    const n = ratings.length;
    const userArr = new Int32Array(n);
    const movieArr = new Int32Array(n);
    const labelArr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      userArr[i] = ratings[i].userId;
      movieArr[i] = ratings[i].movieId;
      labelArr[i] = ratings[i].rating;
    }

    const userTensor = tf.tensor2d(userArr, [n, 1], 'int32');
    const movieTensor = tf.tensor2d(movieArr, [n, 1], 'int32');
    const labelTensor = tf.tensor2d(labelArr, [n, 1], 'float32');

    const EPOCHS = 10;
    const BATCH = 64;

    // Update UI initial
    updateResult(`Training epoch 0/${EPOCHS} - starting...`);

    await model.fit(
      [userTensor, movieTensor],
      labelTensor,
      {
        epochs: EPOCHS,
        batchSize: BATCH,
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            // show epoch message exactly as requested
            updateResult(`Training epoch ${epoch + 1}/${EPOCHS} - loss: ${logs.loss.toFixed(4)}`);
            await tf.nextFrame(); // allow UI update
          },
          onTrainEnd: async () => {
            // Final success message
            updateResult('Model training completed successfully!');
            document.getElementById('predict-btn').disabled = false;
            isTraining = false;

            // Dispose training tensors
            userTensor.dispose();
            movieTensor.dispose();
            labelTensor.dispose();
            await tf.nextFrame();
          }
        }
      }
    );

  } catch (err) {
    console.error('Training error:', err);
    updateResult('Error training model: ' + err.message);
    isTraining = false;
    document.getElementById('predict-btn').disabled = true;
  }
}

// Predict function called by button
async function predictRating() {
  if (isTraining) {
    updateResult('Model is still training. Please wait...');
    return;
  }
  if (!model) {
    updateResult('Model not ready. Please wait until training completes.');
    return;
  }

  const userId = parseInt(document.getElementById('user-select').value, 10);
  const movieId = parseInt(document.getElementById('movie-select').value, 10);
  if (!userId || !movieId) {
    updateResult('Please select both a user and a movie.');
    return;
  }

  try {
    const uT = tf.tensor2d(new Int32Array([userId]), [1, 1], 'int32');
    const mT = tf.tensor2d(new Int32Array([movieId]), [1, 1], 'int32');

    const out = model.predict([uT, mT]);
    const vals = await out.data();
    const pred = vals[0];

    tf.dispose([uT, mT, out]);

    const title = movies[movieId] ? movies[movieId] : `Movie ${movieId}`;
    updateResult(`Predicted rating for User ${userId} on "${title}": <strong>${pred.toFixed(2)}/5</strong>`);
  } catch (err) {
    console.error('Prediction error:', err);
    updateResult('Error making prediction: ' + err.message);
  }
}

// update #result content
function updateResult(text) {
  const el = document.getElementById('result');
  el.innerHTML = text;
}
