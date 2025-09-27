/* script.js
   Responsibilities:
   - Initialize the UI and wire up events.
   - Create a Matrix Factorization model (user/movie embeddings + biases + dot).
   - Train the model in-browser with TensorFlow.js using data loaded by data.js.
   - Predict ratings for a chosen (user, movie) pair.
   - All functions include explanatory comments describing purpose and implementation choices.
*/

/* Global model variable to hold the trained TensorFlow.js model */
let model = null;

/* Local caches used by UI & training */
let _loadedMeta = null;

/* Helper to update the result/status UI area */
function setStatus(msg) {
  const el = document.getElementById('result');
  el.textContent = msg;
}

/* Populate user and movie dropdowns after data is loaded */
function populateDropdowns() {
  const userSelect = document.getElementById('user-select');
  const movieSelect = document.getElementById('movie-select');

  // Clear existing options
  userSelect.innerHTML = '';
  movieSelect.innerHTML = '';

  // Users: we'll provide a reasonable subset to keep dropdown usable.
  // Use the maximum user id parsed (user ids are 1-based).
  const maxUser = _loadedMeta.numUsers;
  const maxMovie = _loadedMeta.numMovies;

  // For users, list ids 1..maxUser
  for (let u = 1; u <= maxUser; u++) {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = `User ${u}`;
    userSelect.appendChild(opt);
  }

  // For movies, use moviesMap where possible (show title)
  const moviesMap = _loadedMeta.moviesMap;
  // movie ids might be sparse; we'll iterate keys from 1..maxMovie and fallback to id when title missing
  for (let m = 1; m <= maxMovie; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = moviesMap[m] ? `${m} — ${moviesMap[m]}` : `Movie ${m}`;
    movieSelect.appendChild(opt);
  }
}

/**
 * createModel(numUsers, numMovies, latentDim)
 * Define a simple Matrix Factorization architecture using embeddings:
 *  - userInput (shape [null,1]) and movieInput (shape [null,1]) are integer index inputs.
 *  - userEmbedding -> vector of size latentDim
 *  - movieEmbedding -> vector of size latentDim
 *  - userBiasEmbedding -> scalar bias per user
 *  - movieBiasEmbedding -> scalar bias per movie
 *  - prediction = dot(userVec, movieVec) + userBias + movieBias + globalBias
 *
 * Rationale:
 *  - This is the canonical MF formulation (latent factors + biases).
 *  - Using small latentDim (e.g., 20) keeps the model light for in-browser training.
 */
function createModel(numUsers, numMovies, latentDim = 20) {
  // Input layers expect shape [batch, 1] and integer indices (dtype int32 when feeding tensors).
  const userInput = tf.input({ shape: [1], name: 'userInput', dtype: 'int32' });
  const movieInput = tf.input({ shape: [1], name: 'movieInput', dtype: 'int32' });

  // Embedding layers map id -> dense vector
  // tf.layers.embedding exists in tfjs and requires inputDim (vocab size) and outputDim
  const userEmbeddingLayer = tf.layers.embedding({
    inputDim: numUsers + 1, // +1 to safely allow indexing up to numUsers (1-based)
    outputDim: latentDim,
    inputLength: 1,
    name: 'userEmbedding'
  });
  const movieEmbeddingLayer = tf.layers.embedding({
    inputDim: numMovies + 1,
    outputDim: latentDim,
    inputLength: 1,
    name: 'movieEmbedding'
  });

  // Bias embeddings (outputDim = 1)
  const userBiasLayer = tf.layers.embedding({
    inputDim: numUsers + 1,
    outputDim: 1,
    inputLength: 1,
    name: 'userBias'
  });
  const movieBiasLayer = tf.layers.embedding({
    inputDim: numMovies + 1,
    outputDim: 1,
    inputLength: 1,
    name: 'movieBias'
  });

  // Apply embedding layers
  // The outputs have shape [batch, 1, latentDim] or [batch, 1, 1] for biases.
  const userLatent = userEmbeddingLayer.apply(userInput);   // shape [batch,1,latentDim]
  const movieLatent = movieEmbeddingLayer.apply(movieInput); // shape [batch,1,latentDim]

  // Flatten embeddings to [batch, latentDim]
  const userVec = tf.layers.flatten().apply(userLatent);
  const movieVec = tf.layers.flatten().apply(movieLatent);

  // Dot product between userVec and movieVec -> [batch, 1]
  // Use tf.layers.dot with axes = -1 (last axis); result shape [batch, 1]
  const dot = tf.layers.dot({ axes: -1 }).apply([userVec, movieVec]);

  // Bias terms: flatten to [batch, 1]
  const uBias = tf.layers.flatten().apply(userBiasLayer.apply(userInput));
  const mBias = tf.layers.flatten().apply(movieBiasLayer.apply(movieInput));

  // Global bias (a trainable scalar). Implement via a Dense layer with 1 unit and no input,
  // but tfjs layers require inputs — so we'll create a small dense on concatenated zero-vector.
  // Simpler: create a Dense layer that takes the dot output and adds a trainable bias by using an Add with a Dense(1, useBias=true) on zeros.
  // However the easiest approach: create a Dense layer on the concatenation of dot and biases to produce final scalar.
  const concat = tf.layers.concatenate().apply([dot, uBias, mBias]); // shape [batch, 3]
  // Final dense layer produces a single scalar prediction (no activation) and provides a trainable global bias
  const prediction = tf.layers.dense({ units: 1, useBias: true, name: 'predictionDense' }).apply(concat);

  // Create model: inputs userInput & movieInput, outputs prediction
  const mfModel = tf.model({
    inputs: [userInput, movieInput],
    outputs: prediction,
    name: 'matrixFactorizationModel'
  });

  return mfModel;
}

/**
 * trainModel()
 * Loads architecture via createModel(), compiles and fits on parsed ratings.
 * Steps:
 *  1. Create model
 *  2. Compile with Adam optimizer and MSE loss
 *  3. Prepare input tensors (user indices, movie indices) and labels (ratings)
 *  4. Train in-browser (few epochs to demonstrate concept)
 *  5. Set global model variable to the trained model
 *
 * Implementation notes:
 *  - We convert user/movie ids to zero-based or keep 1-based? Our embedding layers were sized with inputDim = maxId+1
 *    and expect integer indices aligned to the original 1-based ids; therefore we feed user/movie ids as-is (1-based).
 *  - For performance we shuffle the dataset and use batch size 64.
 */
async function trainModel() {
  setStatus('Creating model architecture...');
  const latentDim = 20; // tradeoff: larger dim => better representational power but slower training
  const numU = _loadedMeta.numUsers;
  const numM = _loadedMeta.numMovies;
  model = createModel(numU, numM, latentDim);

  setStatus('Compiling model...');
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mse']
  });

  // Prepare training tensors
  setStatus('Preparing training tensors (this may take a few seconds)...');
  // Shuffle ratings array for robustness
  const shuffled = tf.util.shuffle(ratings.slice());

  // Create typed arrays for inputs
  const usersArr = new Int32Array(shuffled.length);
  const moviesArr = new Int32Array(shuffled.length);
  const labelsArr = new Float32Array(shuffled.length);

  for (let i = 0; i < shuffled.length; i++) {
    // Note: dataset ids are 1-based, and our embedding inputDim includes +1 so feeding 1-based is OK.
    usersArr[i] = shuffled[i].userId;
    moviesArr[i] = shuffled[i].movieId;
    labelsArr[i] = shuffled[i].rating;
  }

  // Create 2D tensors with shape [n,1] and proper dtype
  const userTensor = tf.tensor2d(usersArr, [usersArr.length, 1], 'int32');
  const movieTensor = tf.tensor2d(moviesArr, [moviesArr.length, 1], 'int32');
  const labelTensor = tf.tensor2d(labelsArr, [labelsArr.length, 1], 'float32');

  // Train
  setStatus('Training model in your browser (this may take ~30s depending on device)...');
  const epochs = 8;  // modest epochs for demo; increase if you want a better fit
  const batchSize = 64;

  // Fit the model and provide onEpochEnd updates to the UI
  await model.fit(
    { userInput: userTensor, movieInput: movieTensor },
    labelTensor,
    {
      epochs,
      batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          setStatus(`Training... epoch ${epoch + 1}/${epochs} — loss: ${logs.loss.toFixed(4)}`);
          // allow UI breathing room
          await tf.nextFrame();
        }
      }
    }
  );

  // Dispose training tensors to free memory
  userTensor.dispose();
  movieTensor.dispose();
  labelTensor.dispose();

  setStatus('Training complete. Model is ready — choose user & movie then click "Predict Rating".');
}

/**
 * predictRating()
 * Called when user clicks the Predict button.
 * Steps:
 *  - Read selected userId and movieId from dropdowns (these are 1-based ids).
 *  - Create input tensors shaped [1,1] dtype int32.
 *  - Call model.predict() to get a tensor output [1,1].
 *  - Retrieve scalar via .data() and display it (clamped to rating range 1..5 with two decimals).
 */
async function predictRating() {
  if (!model) {
    setStatus('Model not ready yet. Please wait for training to complete.');
    return;
  }
  const userSelect = document.getElementById('user-select');
  const movieSelect = document.getElementById('movie-select');
  const userId = parseInt(userSelect.value, 10);
  const movieId = parseInt(movieSelect.value, 10);

  setStatus(`Predicting rating for User ${userId} × Movie ${movieId} ...`);

  // Create input tensors: shape [1,1], dtype int32 (we keep ids 1-based to match embedding inputDim sizing)
  const uTensor = tf.tensor2d(new Int32Array([userId]), [1, 1], 'int32');
  const mTensor = tf.tensor2d(new Int32Array([movieId]), [1, 1], 'int32');

  // model.predict supports either tensor inputs in order or a dict keyed by input names
  const out = model.predict({ userInput: uTensor, movieInput: mTensor });
  // out is a Tensor shape [1,1]; extract the scalar
  const outData = await out.data();
  let pred = outData[0];

  // Clean up
  uTensor.dispose();
  mTensor.dispose();
  out.dispose();

  // Ratings in dataset are between 1 and 5; clamp and format
  if (!Number.isFinite(pred)) {
    setStatus('Prediction produced NaN or invalid number.');
    return;
  }

  pred = Math.min(5, Math.max(1, pred)); // clamp
  const predStr = pred.toFixed(2);

  // If movie title is available, show title
  const movieTitle = (_loadedMeta.moviesMap && _loadedMeta.moviesMap[movieId]) ? ` — ${_loadedMeta.moviesMap[movieId]}` : '';
  setStatus(`Predicted rating for User ${userId} on Movie ${movieId}${movieTitle}: ${predStr} / 5`);
}

/* Initialization */
window.onload = async function() {
  // Wire up predict button early to avoid race conditions
  document.getElementById('predict-btn').addEventListener('click', () => {
    // We intentionally don't await here to keep UI responsive
    predictRating();
  });

  try {
    setStatus('Loading dataset (u.item & u.data) — please wait...');
    _loadedMeta = await loadData(); // function from data.js

    // Populate dropdowns
    populateDropdowns();

    // Start training
    await trainModel();

    // After training, UI is updated in trainModel
  } catch (err) {
    console.error(err);
    setStatus(`Error loading or training model: ${err.message}. If CORS prevents fetching from files.grouplens.org, please host u.item & u.data locally next to these files and adjust loadData() URLs.`);
  }
};
