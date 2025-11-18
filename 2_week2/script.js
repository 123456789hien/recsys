// script.js
// UI logic for classic content-based recommendations using cosine similarity
// plus LLM feature engineering prompt generator for the 4-stage tutorial

let movieSelect
let resultParagraph

// Initialize the app when the window loads
window.onload = async function () {
    movieSelect = document.getElementById("movie-select")
    resultParagraph = document.getElementById("result")

    if (!movieSelect || !resultParagraph) {
        console.error("Missing #movie-select or #result in HTML")
        return
    }

    resultParagraph.innerText = "Loading data..."

    try {
        // loadData comes from data.js
        await loadData()
        populateMoviesDropdown()
        resultParagraph.innerText =
            'Data loaded. Please select a movie and click "Get Recommendations".'
    } catch (error) {
        console.error(error)
        resultParagraph.innerText = "Error loading data: " + error.message
    }
}

/**
 * Populate the movie dropdown with sorted movie titles
 */
function populateMoviesDropdown() {
    if (!Array.isArray(movies) || movies.length === 0) {
        if (resultParagraph) {
            resultParagraph.innerText = "No movies available."
        }
        return
    }

    const sortedMovies = [...movies].sort((a, b) =>
        a.title.localeCompare(b.title)
    )

    movieSelect.innerHTML = ""

    for (const movie of sortedMovies) {
        const option = document.createElement("option")
        option.value = movie.id
        option.textContent = movie.title
        movieSelect.appendChild(option)
    }
}

/**
 * Cosine similarity for genre sets treated as binary vectors
 * genresA and genresB are arrays of genre strings
 *
 * cosine(A, B) = |A ∩ B| / sqrt(|A| * |B|)
 */
function cosineSimilarityFromGenreSets(genresA, genresB) {
    if (!Array.isArray(genresA) || !Array.isArray(genresB)) {
        return 0
    }

    const setA = new Set(genresA)
    const setB = new Set(genresB)

    const sizeA = setA.size
    const sizeB = setB.size

    if (sizeA === 0 || sizeB === 0) {
        return 0
    }

    let intersectionSize = 0
    for (const genre of setA) {
        if (setB.has(genre)) {
            intersectionSize++
        }
    }

    const denominator = Math.sqrt(sizeA * sizeB)
    if (denominator === 0) return 0

    return intersectionSize / denominator
}

/**
 * Main function called when user clicks "Get Recommendations"
 * 1. Get user movie selection
 * 2. Compute cosine similarity against other movies
 * 3. Show top 2 recommended titles
 */
function getRecommendations() {
    if (!movieSelect || !resultParagraph) return

    const selectedIdStr = movieSelect.value

    // Step 1: get user selection
    if (!selectedIdStr) {
        resultParagraph.innerText = "Please select a movie first."
        return
    }

    const selectedId = parseInt(selectedIdStr, 10)

    // Step 2: find the liked movie
    const likedMovie = movies.find(
        (m) => Number(m.id) === selectedId
    )

    if (!likedMovie) {
        resultParagraph.innerText =
            "Could not find the selected movie in the dataset."
        return
    }

    if (!Array.isArray(likedMovie.genres) || likedMovie.genres.length === 0) {
        resultParagraph.innerText =
            `The movie "${likedMovie.title}" has no genre information so we cannot compute recommendations.`
        return
    }

    // Candidate set: all movies except the liked one
    const candidateMovies = movies.filter(
        (m) => Number(m.id) !== selectedId
    )

    // Step 3: compute cosine similarity for each candidate
    const scoredMovies = candidateMovies
        .map((movie) => {
            const score = cosineSimilarityFromGenreSets(
                likedMovie.genres,
                movie.genres || []
            )
            return { ...movie, score }
        })
        .filter((movie) => movie.score > 0)

    if (scoredMovies.length === 0) {
        resultParagraph.innerText =
            `No similar movies found for "${likedMovie.title}".`
        return
    }

    // Step 4: sort by similarity and take top 2
    scoredMovies.sort((a, b) => b.score - a.score)
    const topK = scoredMovies.slice(0, 2)

    const recTexts = topK.map(
        (movie) => `${movie.title} (similarity: ${movie.score.toFixed(3)})`
    )

    // Step 5: present the result
    resultParagraph.innerText =
        `Because you liked "${likedMovie.title}" we recommend: ` +
        recTexts.join(", ") +
        "."
}

/**
 * Generate LLM prompts for the 4-stage tutorial (Stages 2–4 use LLM)
 * Stage 1 is described in the UI as a pure data engineering step.
 */
function generateLLMPrompts() {
    const rawDescriptionElement = document.getElementById("raw-description")
    const promptExtractElement = document.getElementById("prompt-extract")
    const promptConsolidateElement = document.getElementById("prompt-consolidate")
    const promptFinalizeElement = document.getElementById("prompt-finalize")

    if (!rawDescriptionElement ||
        !promptExtractElement ||
        !promptConsolidateElement ||
        !promptFinalizeElement) {
        console.error("Missing LLM prompt elements in HTML")
        return
    }

    let description = rawDescriptionElement.value.trim()

    // If user leaves it empty, use the Luke Skywalker example from the tutorial
    if (!description) {
        description =
            "A young farm boy named Luke Skywalker joins a rebel alliance " +
            "to destroy a planet-destroying space station, learning a mystical " +
            "power called the Force along the way."
    }

    // Stage 2: Extract Features
    const stage2Prompt =
`Stage 2 — Extract Features

You are helping a recommender system engineer extract structured features
from unstructured movie plot text.

Extract the following features from the movie description below. Return the answer as a JSON object.

- "sub-genre": (e.g., Space Opera, Heist, Romantic Comedy)
- "themes": (e.g., Good vs Evil, Coming of Age, Redemption, Hope)

The output should follow this style:
{"sub-genre": ["Space Opera"], "themes": ["Good vs Evil", "Coming of Age", "Hope"]}

Movie description:
"""${description}"""`

    // Stage 3: Consolidate Keywords
    const stage3Prompt =
`Stage 3 — Consolidate Keywords

You are a clustering assistant for a recommender system.

Task:
Given a list of raw keywords for sub-genres and themes collected from many movies,
cluster and canonicalize similar terms.

For example:
- "Sci-Fi" and "Science Fiction" should become "Science Fiction".
- "Space Opera" and "Galactic Adventure" can be grouped under "Science Fiction".

Return a JSON object with two arrays:
- "sub_genre_master_list": [...canonical sub-genre labels...]
- "theme_master_list": [...canonical theme labels...]

Example raw keywords from multiple movies:
["Space Opera", "Sci-Fi", "Science Fiction", "Galactic Adventure",
 "Good vs Evil", "Coming of Age", "Hero's Journey"]

Only output the JSON object with the two arrays.`

    // Stage 4: Finalize and Encode
    const stage4Prompt =
`Stage 4 — Finalize and Encode

You will assign canonical sub-genres and themes to a movie,
using master lists that have already been consolidated in Stage 3.

Given:
1) A raw movie description
2) Master lists for sub-genres and themes

Classify the movie by selecting only labels that appear in the master lists.
Return a JSON object with:

- "sub_genre": list of selected sub-genres
- "themes": list of selected themes

After this JSON output, the engineer will one-hot encode the labels into vectors, for example:
Sub-genre: [0, 1, 0, ...] (1 at position "Science Fiction")
Themes: [1, 1, 0, 0, ...] (1 for "Good vs Evil" and "Coming of Age")

Master Sub-genres example:
[Science Fiction, Fantasy, Action Thriller, Romantic Comedy, Heist, Space Opera]

Master Themes example:
[Good vs Evil, Coming of Age, Redemption, Sacrifice, Hope, Identity, Rebellion]

Movie description:
"""${description}"""

Only output the JSON object with "sub_genre" and "themes".`

    promptExtractElement.textContent = stage2Prompt
    promptConsolidateElement.textContent = stage3Prompt
    promptFinalizeElement.textContent = stage4Prompt
}
