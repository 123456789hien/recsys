// data.js
// Responsible for loading and parsing MovieLens data (u.item and u.data)

let movies = []   // { id, title, genres }
let ratings = []  // { userId, itemId, rating, timestamp }

/**
 * Load data from local files u.item and u.data
 * This function should be awaited before using movies or ratings
 */
async function loadData() {
    const resultElement = document.getElementById("result")

    try {
        // Load u.item
        const itemResponse = await fetch("u.item")
        if (!itemResponse.ok) {
            throw new Error("Failed to load u.item")
        }
        const itemText = await itemResponse.text()
        parseItemData(itemText)

        // Load u.data
        const dataResponse = await fetch("u.data")
        if (!dataResponse.ok) {
            throw new Error("Failed to load u.data")
        }
        const dataText = await dataResponse.text()
        parseRatingData(dataText)

        if (resultElement) {
            resultElement.innerText = "Data loaded. Please select a movie."
        }
    } catch (error) {
        console.error("Error while loading data:", error)
        if (resultElement) {
            resultElement.innerText =
                "Error loading data. Please make sure u.item and u.data are in the same folder as index.html."
        }
        throw error
    }
}

/**
 * Parse u.item content
 * Each line has format:
 * movie id | movie title | release date | video release date | IMDb URL | genre flags (19 columns)
 * We use the last 19 fields as binary flags
 * We map 18 genres from Action to Western, ignoring the "Unknown" flag
 */
function parseItemData(text) {
    movies = []

    // 18 genres from "Action" to "Western" (MovieLens 100K)
    const genreNames = [
        "Action",
        "Adventure",
        "Animation",
        "Children's",
        "Comedy",
        "Crime",
        "Documentary",
        "Drama",
        "Fantasy",
        "Film-Noir",
        "Horror",
        "Musical",
        "Mystery",
        "Romance",
        "Sci-Fi",
        "Thriller",
        "War",
        "Western"
    ]

    const lines = text.split("\n")

    for (const line of lines) {
        if (!line.trim()) continue

        const parts = line.split("|")
        if (parts.length < 6) continue

        const id = parseInt(parts[0], 10)
        const title = parts[1]

        // Take the last 19 fields as genre flags
        const flags = parts.slice(-19)

        const genres = []

        // flags[0] is "Unknown" so we skip it and start from index 1
        for (let i = 1; i < flags.length; i++) {
            const flag = flags[i]
            if (flag === "1") {
                const genreName = genreNames[i - 1]
                if (genreName) {
                    genres.push(genreName)
                }
            }
        }

        movies.push({ id, title, genres })
    }
}

/**
 * Parse u.data content
 * Each line: user id \t item id \t rating \t timestamp
 */
function parseRatingData(text) {
    ratings = []

    const lines = text.split("\n")
    for (const line of lines) {
        if (!line.trim()) continue

        const parts = line.split("\t")
        if (parts.length < 4) continue

        const userId = parseInt(parts[0], 10)
        const itemId = parseInt(parts[1], 10)
        const rating = parseInt(parts[2], 10)
        const timestamp = parseInt(parts[3], 10)

        ratings.push({ userId, itemId, rating, timestamp })
    }
}
