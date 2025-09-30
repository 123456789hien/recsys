// script.js — TensorFlow.js model, training, prediction logic

let model;

window.onload = async () => {
  document.getElementById("result").innerText = "Loading data...";
  await loadData();
  populateDropdowns();
  document.getElementById("result").innerText = "Training model...";
  await trainModel();
  document.getElementById("predict-btn").disabled = false;
  document.getElementById("result").innerText = "✅ Model trained. Ready!";
};

function populateDropdowns() {
  const userSelect = document.getElementById("user-select");
  const movieSelect = document.getElementById("movie-select");

  // Fill user dropdown
  for (let i = 0; i < numUsers; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `User ${i + 1}`;
    userSelect.appendChild(opt);
  }

  // Fill movie dropdown (limit to 200 for UI performance)
  movies.slice(0, 200).forEach(movie => {
    const opt = document.createElement("option");
    opt.value = movie.movieId;
    opt.textContent = movie.title;
    movieSelect.appendChild(opt);
  });
}

function createModel(numUsers, numMovies, latentDim = 50) {
  // Inputs
  const userInput = tf.input({shape: [1], dtype: "int32"});
  const movieInput = tf.input({shape: [1], dtype: "int32"});

  // Embeddings
  const userEmbedding = tf.layers.embedding({
    inputDim: numUsers,
    outputDim: latentDim,
    embeddingsInitializer: "randomNormal"
  }).apply(userInput);

  const movieEmbedding = tf.layers.embedding({
    inputDim: numMovies,
    outputDim: latentDim,
    embeddingsInitializer: "randomNormal"
  }).apply(movieInput);

  // Flatten
  const userVec = tf.layers.flatten().apply(userEmbedding);
  const movieVec = tf.layers.flatten().apply(movieEmbedding);

  // Dot product
  const dot = tf.layers.dot({axes: 1}).apply([userVec, movieVec]);

  // Dense layer to scale output
  const output = tf.layers.dense({units: 1, activation: "linear"}).apply(dot);

  return tf.model({inputs: [userInput, movieInput], outputs: output});
}

async function trainModel() {
  model = createModel(numUsers, numMovies);

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "meanSquaredError"
  });

  // Prepare data
  const userIds = ratings.map(r => r.userId);
  const movieIds = ratings.map(r => r.movieId);
  const ratingVals = ratings.map(r => r.rating);

  const userTensor = tf.tensor2d(userIds, [userIds.length, 1], "int32");
  const movieTensor = tf.tensor2d(movieIds, [movieIds.length, 1], "int32");
  const ratingTensor = tf.tensor2d(ratingVals, [ratingVals.length, 1], "float32");

  await model.fit([userTensor, movieTensor], ratingTensor, {
    epochs: 5,
    batchSize: 64,
    validationSplit: 0.1,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        document.getElementById("result").innerText =
          `Training... Epoch ${epoch + 1}, Loss: ${logs.loss.toFixed(4)}`;
      }
    }
  });

  userTensor.dispose();
  movieTensor.dispose();
  ratingTensor.dispose();
}

async function predictRating() {
  const userId = parseInt(document.getElementById("user-select").value);
  const movieId = parseInt(document.getElementById("movie-select").value);

  const userTensor = tf.tensor2d([userId], [1, 1], "int32");
  const movieTensor = tf.tensor2d([movieId], [1, 1], "int32");

  const prediction = model.predict([userTensor, movieTensor]);
  const value = (await prediction.data())[0];

  const clipped = Math.min(5, Math.max(1, value));

  document.getElementById("result").innerText =
    `⭐ Predicted rating ≈ ${clipped.toFixed(2)} / 5`;

  userTensor.dispose();
  movieTensor.dispose();
  prediction.dispose();
}
