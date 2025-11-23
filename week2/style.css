// script.js
// UI logic and recommendation logic using COSINE similarity on genre vectors

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
        // loadData is defined in data.js
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
 * Cosine similarity for genre sets (binary vectors)
 * genresA and genresB are arrays of strings, for example ["Action", "Sci-Fi"]
 *
 * For binary genre vectors:
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
 * 2. Provide recommendations based on it
 * 3. Similarity function is COSINE not Jaccard
 */
function getRecommendations() {
    if (!movieSelect || !resultParagraph) return

    const selectedIdStr = movieSelect.value

    // Step 1: Get user selection
    if (!selectedIdStr) {
        resultParagraph.innerText = "Please select a movie first."
        return
    }

    const selectedId = parseInt(selectedIdStr, 10)

    // Step 2: Find the liked movie from global movies array
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

    // Build candidate set: all other movies
    const candidateMovies = movies.filter(
        (m) => Number(m.id) !== selectedId
    )

    // Compute cosine similarity for each candidate
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

    // Sort by cosine similarity descending
    scoredMovies.sort((a, b) => b.score - a.score)

    // Take top 2 recommendations
    const topK = scoredMovies.slice(0, 2)

    const recTexts = topK.map(
        (movie) => `${movie.title} (similarity: ${movie.score.toFixed(3)})`
    )

    resultParagraph.innerText =
        `Because you liked "${likedMovie.title}" we recommend: ` +
        recTexts.join(", ") +
        "."
}
