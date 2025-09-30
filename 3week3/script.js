// =======================
// script.js (updated for UI logging)
// =======================

let model;
let trainingComplete = false;

// Called on page load
window.onload = async () => {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "Loading data...";

  await loadData();

  // populate dropdowns
  const userSelect = document.getElementById("user-select");
  for (let i = 1; i <= numUsers; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `User ${i}`;
    userSelect.appendChild(option);
  }

  const movieSelect = document.getElementById("movie-select");
  for (let [id, title] of Object.entries(movies)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = title;
    movieSelect.appendChild(option);
  }

  resultDiv.innerHTML += "<br>Data loaded successfully.<br>Starting training...";
  await trainModel();
};

// Create MF model
function createModel(numUsers, numMovies, latentDim) {
  const userInput = tf.input({ shape: [1], name: "user" });
  const movieInput = tf.input({ shape: [1], name: "movie" });

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

  const dotProduct = tf.layers.dot({ axes: 1 }).apply([userVec, movieVec]);
  const output = tf.layers.dense({ units: 1 }).apply(dotProduct);

  const model = tf.model({ inputs: [userInput, movieInput], outputs: output });
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "meanSquaredError"
  });

  return model;
}

// Training model
async function trainModel() {
  const resultDiv = document.getElementById("result");
  model = createModel(numUsers, numMovies, 20);

  const userTensor = tf.tensor2d(ratings.map(r => [r.user]));
  const movieTensor = tf.tensor2d(ratings.map(r => [r.movie]));
  const ratingTensor = tf.tensor2d(ratings.map(r => [r.rating]));

  const EPOCHS = 5;
  const BATCH_SIZE = 64;

  resultDiv.innerHTML += "<br>Training started...";

  await model.fit([userTensor, movieTensor], ratingTensor, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        resultDiv.innerHTML += `<br>Epoch ${epoch + 1}/${EPOCHS} - loss=${logs.loss.toFixed(4)}`;
      },
      onTrainEnd: () => {
        resultDiv.innerHTML += "<br>✅ Training complete. Model ready for prediction.";
        trainingComplete = true;
      }
    }
  });
}

// Predict rating
async function predictRating() {
  const resultDiv = document.getElementById("result");
  if (!trainingComplete) {
    resultDiv.innerHTML += "<br>⚠️ Model not ready yet!";
    return;
  }

  const userId = parseInt(document.getElementById("user-select").value);
  const movieId = parseInt(document.getElementById("movie-select").value);

  const userTensor = tf.tensor2d([[userId]]);
  const movieTensor = tf.tensor2d([[movieId]]);

  const prediction = model.predict([userTensor, movieTensor]);
  const rating = (await prediction.data())[0];

  resultDiv.innerHTML += `<br>⭐ Predicted rating for User ${userId} on "${movies[movieId]}" is <b>${rating.toFixed(2)}</b>`;
}
