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
  model = createModel(numUsers, numMovies);

  // Prepare data
  const userTensor = tf.tensor2d(ratings.map(r => [r.userId]), [ratings.length, 1]);
  const movieTensor = tf.tensor2d(ratings.map(r => [r.movieId]), [ratings.length, 1]);
  const ratingTensor = tf.tensor2d(ratings.map(r => [r.rating]), [ratings.length, 1]);

  // Train
  await model.fit([userTensor, movieTensor], ratingTensor, {
    epochs: 5,
    batchSize: 64,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}: loss=${logs.loss.toFixed(4)}`);
      }
    }
  });

  document.getElementById("result").textContent = "Model ready for predictions!";
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
