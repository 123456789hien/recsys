Project Specification: Matrix Factorization Recommender with TensorFlow.js

1. CONTEXT

The goal is to build a web application that demonstrates Matrix Factorization for collaborative filtering.
It must:

Load and parse the MovieLens 100K dataset (u.item, u.data) from a given URL.

Train a recommender model entirely in the browser using TensorFlow.js.

Predict a user’s rating for a selected movie.

Organize logic modularly across data.js and script.js.

2. OUTPUT FORMAT

Provide four complete code blocks corresponding to:

index.html

style.css

data.js

script.js

3. index.html INSTRUCTIONS

The page must have:

A title and a main heading.

Two dropdown menus: one for selecting a user (#user-select) and one for selecting a movie (#movie-select).

A “Predict Rating” button that calls predictRating().

A result area (#result) for status messages and predictions.

Load scripts in order:

<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js"></script>
<script src="data.js"></script>
<script src="script.js"></script>

4. style.css INSTRUCTIONS

Clean, modern, centered layout.

Professional and user-friendly design.

Similar styling standards as previous exercises (responsive, simple fonts, clear spacing, button styling).

5. data.js INSTRUCTIONS

Responsible for loading and parsing data.

Must include:

async function loadData() → fetch u.item and u.data.

function parseItemData(text) → extract movieId, title.

function parseRatingData(text) → extract userId, movieId, rating.

Store:

numUsers = total unique users.

numMovies = total unique movies.

Note: Convert IDs to zero-based indices before using in embeddings.

6. script.js INSTRUCTIONS

This file handles the TensorFlow.js model definition, training, and prediction.

Global Variables

let model; → trained TensorFlow.js model.

Access ratings, movies, numUsers, numMovies from data.js.

Initialization

On window.onload:

Call await loadData().

Populate dropdowns with users and movies.

Call trainModel() and update UI with training status.

Model Definition: createModel(numUsers, numMovies, latentDim)

Inputs:

userInput (user IDs)

movieInput (movie IDs)

Embedding Layers:

User embedding → shape [numUsers, latentDim]

Movie embedding → shape [numMovies, latentDim]

Latent Vectors: Flatten embeddings.

Prediction: Dot product of user and movie latent vectors (optionally add bias terms).

Output: Scalar rating prediction (linear activation).

Return tf.model with defined inputs and output.

Training: async function trainModel()

Call createModel(numUsers, numMovies, latentDim=50).

Compile:

optimizer = tf.train.adam(0.001)

loss = 'meanSquaredError'

Prepare training data:

Convert (userIds, movieIds) and ratings into tensors (tf.tensor2d).

Normalize ratings to [0,1] if needed, then scale back to [1,5] at prediction.

Train with await model.fit(inputs, ratings, {epochs: 10, batchSize: 64, validationSplit: 0.1}).

Update UI: model ready for prediction.

Prediction: async function predictRating()

Get selected userId and movieId.

Convert into tensors.

Call model.predict().

Extract predicted rating using .data().

Clip values to [1,5] and show in #result. Example: “Predicted rating ≈ 3.72 / 5”.

Memory & Safety

Use tf.tidy() to manage tensors.

Dispose intermediate tensors after use.

Handle errors: if model not trained or selection invalid, display a warning.
