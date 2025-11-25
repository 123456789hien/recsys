// script.js
// Two-Tower retrieval in the browser
// Item tower: movie embeddings from movies_db.json (offline, Colab)
// User tower: text query → embedding vector in the same space
// Retrieval: cosine(user_vector, movie_vector) → Top-K recommendations

let isDataLoaded = false

window.onload = function () {
    const result = document.getElementById("result")
    if (result) {
        result.innerText = "No results yet. Click 'Load Movie Embedding DB' to load the data."
    }
}

/**
 * Handler for "Load Movie Embedding DB" button.
 * Connects to the item tower DB created in Colab.
 */
async function handleLoadDB() {
    const result = document.getElementById("result")
    if (result) {
        result.innerText = "Loading movie embedding DB..."
    }

    try {
        await loadMovieDB()  // defined in data.js
        isDataLoaded = true

        if (result) {
            result.innerText =
                "Movie DB loaded. Now describe what you want to watch and click 'Recommend Movies'."
        }
    } catch (error) {
        console.error(error)
        if (result) {
            result.innerText = "Failed to load movie DB: " + error.message
        }
        isDataLoaded = false
    }
}

/**
 * Handler for "Recommend Movies" button.
 * Implements the user tower + similarity search part of the lecture example.
 */
async function handleRecommend() {
    const queryInput = document.getElementById("query-input")
    const result = document.getElementById("result")
    const resultList = document.getElementById("result-list")
    const queryInfo = document.getElementById("query-embedding-info")

    if (!queryInput || !result || !resultList || !queryInfo) return

    if (!isDataLoaded || !Array.isArray(movieItems) || movieItems.length === 0) {
        result.innerText = "Please load the movie DB first."
        return
    }

    const query = queryInput.value.trim()
    if (!query) {
        result.innerText =
            "Please type a query, for example a description of a scary movie with no ghosts."
        return
    }

    result.innerText = "Encoding query and computing similarities..."
    resultList.innerHTML = ""
    queryInfo.innerText = ""

    try {
        // User tower: encode query to a vector
        const queryEmbedding = await encodeQuery(query)

        if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
            result.innerText = "Failed to encode query. Check encodeQuery implementation."
            return
        }

        if (embeddingDim && queryEmbedding.length !== embeddingDim) {
            result.innerText =
                `Dimension mismatch: query vector dim = ${queryEmbedding.length}, ` +
                `item vector dim = ${embeddingDim}.`
            return
        }

        queryInfo.innerText = `Query embedding dimension: ${queryEmbedding.length}`

        // Two-Tower interaction: cosine(user_vector, movie_vector)
        const scoredItems = movieItems
            .map((item) => {
                const score = cosineSimilarity(queryEmbedding, item.embedding || [])
                return { ...item, score }
            })
            .filter((item) => !Number.isNaN(item.score) && item.score > 0)

        if (scoredItems.length === 0) {
            result.innerText = "No similar items found for this query."
            return
        }

        // Sort by similarity and take top K
        scoredItems.sort((a, b) => b.score - a.score)
        const topK = scoredItems.slice(0, 10)

        result.innerText =
            `Top ${topK.length} recommendations based on your query (cosine similarity in Two-Tower space):`

        for (const item of topK) {
            const li = document.createElement("li")
            const genresText = Array.isArray(item.genres) && item.genres.length > 0
                ? ` — genres: ${item.genres.join(", ")}`
                : ""
            li.textContent =
                `${item.title} [movieId=${item.movieId}] ` +
                `(similarity = ${item.score.toFixed(3)})${genresText}`
            resultList.appendChild(li)
        }
    } catch (error) {
        console.error(error)
        result.innerText = "Error during recommendation: " + error.message
    }
}

/**
 * User-tower encoder for query text.
 *
 * IMPORTANT:
 * In the real assignment, replace this function with the same encoder
 * used in Colab (for example a tf.js SBERT model exported from the notebook).
 *
 * For now this function builds a deterministic embedding so the demo works
 * end-to-end without external dependencies.
 */
async function encodeQuery(text) {
    // Basic preprocessing similar to "LLM query structuring" + tokenization
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ")
    const tokens = cleaned.split(/\s+/).filter(Boolean)

    if (!embeddingDim) {
        const dim = 64
        console.warn("embeddingDim is 0, using fallback dimension:", dim)
        embeddingDim = dim
    }

    const dim = embeddingDim
    const vector = new Array(dim).fill(0)

    for (const tok of tokens) {
        const idx = positiveHash(tok) % dim
        vector[idx] += 1
    }

    // L2 normalize to mimic an embedding
    return l2Normalize(vector)
}

/**
 * Simple positive hash for strings (deterministic).
 */
function positiveHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

/**
 * L2 normalization for a vector.
 */
function l2Normalize(vec) {
    let sumSq = 0
    for (let i = 0; i < vec.length; i++) {
        sumSq += vec[i] * vec[i]
    }
    if (sumSq === 0) return vec.slice()
    const norm = Math.sqrt(sumSq)
    return vec.map((x) => x / norm)
}

/**
 * Cosine similarity between two numeric vectors.
 */
function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return 0
    const len = Math.min(a.length, b.length)
    if (len === 0) return 0

    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < len; i++) {
        const va = a[i] || 0
        const vb = b[i] || 0
        dot += va * vb
        normA += va * va
        normB += vb * vb
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
