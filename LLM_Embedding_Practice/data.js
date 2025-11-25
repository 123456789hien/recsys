// data.js
// Load Two-Tower item embeddings from a JSON DB (created offline in Colab)

let movieItems = []   // { movieId, title, genres, embedding: number[] }
let embeddingDim = 0

/**
 * Load movie embedding DB exported from Colab.
 * Expected file: data/movies_db.json
 *
 * Expected JSON format:
 * [
 *   {
 *     "movieId": 1,
 *     "title": "Toy Story (1995)",
 *     "genres": ["Animation", "Children's", "Comedy"],
 *     "embedding": [0.0213, -0.5832, ...]
 *   },
 *   ...
 * ]
 */
async function loadMovieDB() {
    const statusEl = document.getElementById("load-status")

    try {
        if (statusEl) {
            statusEl.innerText = "Loading data/movies_db.json..."
        }

        const url = "./data/movies_db.json"
        console.log("Fetching movie DB from:", new URL(url, window.location.href).toString())

        const response = await fetch(url)
        if (!response.ok) {
            throw new Error("Failed to load movies_db.json")
        }

        const data = await response.json()

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("movies_db.json is empty or not an array")
        }

        movieItems = data.map((item) => {
            const embedding = Array.isArray(item.embedding) ? item.embedding : []
            return {
                movieId: item.movieId,
                title: item.title,
                genres: item.genres || [],
                embedding
            }
        })

        embeddingDim = movieItems[0].embedding.length || 0

        if (statusEl) {
            statusEl.innerText = `Loaded ${movieItems.length} movies (embedding dim = ${embeddingDim}).`
        }

        updateDebugInfo()
    } catch (error) {
        console.error("Error while loading movie DB:", error)
        if (statusEl) {
            statusEl.innerText =
                "Error loading movies_db.json. Check that data/movies_db.json exists and has the correct format."
        }
        throw error
    }
}

/**
 * Update debug panel with simple stats about the embedding space
 */
function updateDebugInfo() {
    const debugText = document.getElementById("debug-text")
    if (!debugText) return

    if (!Array.isArray(movieItems) || movieItems.length === 0) {
        debugText.innerText = "No data loaded yet."
        return
    }

    const sampleTitles = movieItems.slice(0, 3).map((m) => m.title)
    debugText.innerText =
        `Items loaded: ${movieItems.length}\n` +
        `Embedding dimension: ${embeddingDim}\n` +
        `Sample titles: ${sampleTitles.join(" | ")}`
}
