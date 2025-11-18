// data.js
// Load and parse MovieLens data (u.item and u.data) from the data/ folder

let movies = []   // { id, title, genres }
let ratings = []  // { userId, itemId, rating, timestamp }

/**
 * Load data from local files data/u.item and data/u.data
 * This function should be awaited before using movies or ratings
 */
async function loadData() {
    const resultElement = document.getElementById("result")

    try {
        const itemUrl = "./data/u.item"
        const dataUrl = "./data/u.data"

        // Debug logs in case of wrong paths
        console.log("Fetching item file from:", new URL(itemUrl, window.location.href).toString())
        console.log("Fetching rating file from:", new URL(dataUrl, window.location.href).toString())

        // Load u.item
        const itemResponse = await fetch(itemUrl)
        if (!itemResponse.ok) {
            throw new Error("Failed to load u.item")
        }
        const itemText = await itemResponse.text()
        parseItemData(itemText)

        // Load u.data
        const dataResponse = await fetch(dataUrl)
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
                "Error loading data. Check that data/u.item and data/u.data exist next to index.html."
        }
        throw error
    }
}

/**
 * Parse u.item content
 * Each line:
 * movie id | movie title | release date | video release date | IMDb URL | 19 genre flags
 * We map the last 19 columns to genres. Column 0 is Unknown which we ignore.
 */
function parseItemData(text) {
    movies = []

    // 18 standard MovieLens genres from Action to Western
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

        // flags[0] is Unknown, skip it and start from index 1
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
 * Each line:
 * user id \t item id \t rating \t timestamp
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
