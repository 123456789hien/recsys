// ========================
// script.js
// Model definition, training, prediction
// ========================

let model;  // Global model

// ------------------------
// Populate dropdown menus
// ------------------------
function populateDropdowns() {
  const userSelect = document.getElementById("user-select");
  for (let i = 1; i <= numUsers; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `User ${i}`;
    userSelect.appendChild(option);
  }

  const movieSelect = document.getElementById("movie-select");
  movies.forEach(m => {
    const option = document.createElement("option");
    option.value = m.id;
    option.textContent = m.title;
    movieSelect.appendChild(option);
  });
}

// ------------------------
// Create MF model
// ------------------------
function createModel(numUsers, numMovies, latentDim = 8) {
  // User input & embedding
  const userInput = tf.input({ shape: [1], dtype: 'int32' });
  const userEmbedding = tf.layers.embedding({
    inputDim: numUsers + 1,
    outputDim: latentDim
  }).apply(userInput);
  const userVec = tf.layers.flatten().apply(userEmbedding);

  // Movie input & embedding
  const movieInput = tf.input({ shape: [1], dtype: 'int32' });
  const movieEmbedding = tf.layers.embedding({
    inputDim: numMovies + 1,
    outputDim: latentDim
  }).apply(movieInput);
  const movieVec = tf.layers.flatten().apply(movieEmbedding);

  // Dot product
  const dot = tf.layers.dot({ axes: 1 }).apply([userVec, movieVec]);

  // Create and compile model
  const model = tf.model({ inputs: [userInput, movieInput], outputs: dot });
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError'
  });

  return model;
}

// ------------------------
// Train the model
// ------------------------
async function trainModel() {
    try {
        isTraining = true;
        document.getElementById('predict-btn').disabled = true;
        
        // Create model
        model = createModel(numUsers, numMovies, 10);
        
        // Compile model
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError'
        });
        
        // Prepare training data
        const userIds = ratings.map(r => r.userId);
        const movieIds = ratings.map(r => r.movieId);
        const ratingValues = ratings.map(r => r.rating);
        
        const userTensor = tf.tensor2d(userIds, [userIds.length, 1]);
        const movieTensor = tf.tensor2d(movieIds, [movieIds.length, 1]);
        const ratingTensor = tf.tensor2d(ratingValues, [ratingValues.length, 1]);
        
        // Train model
        updateStatus('Training model... (This may take a moment)');
        
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
        
        // Clean up tensors
        tf.dispose([userTensor, movieTensor, ratingTensor]);
        
        // Update UI
        updateStatus('Model training completed successfully!');
        document.getElementById('predict-btn').disabled = false;
        isTraining = false;
        
    } catch (error) {
        console.error('Training error:', error);
        updateStatus('Error training model: ' + error.message, true);
        isTraining = false;
    }
}

// ------------------------
// Predict rating
// ------------------------
async function predictRating() {
  const userId = parseInt(document.getElementById("user-select").value);
  const movieId = parseInt(document.getElementById("movie-select").value);

  if (!model) {
    document.getElementById("result").textContent = "Model is not ready yet.";
    return;
  }

  const userTensor = tf.tensor2d([userId], [1, 1]);
  const movieTensor = tf.tensor2d([movieId], [1, 1]);

  const prediction = model.predict([userTensor, movieTensor]);
  const predictedValue = (await prediction.data())[0];

  const movieTitle = movies.find(m => m.id === movieId).title;
  document.getElementById("result").textContent =
    `Predicted rating for User ${userId} on "${movieTitle}" is: ${predictedValue.toFixed(2)} out of 5`;
}

// ------------------------
// Initialization
// ------------------------
window.onload = async () => {
  document.getElementById("result").textContent = "Loading data...";
  await loadData();
  populateDropdowns();
  document.getElementById("result").textContent = "Training model...";
  await trainModel();
};
