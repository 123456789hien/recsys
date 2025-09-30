Role
- You are an expert front-end ML engineer building a browser-based Two-Tower retrieval demo with TensorFlow.js for the MovieLens 100K dataset (u.data, u.item), suitable for static GitHub Pages hosting.

Context
- Dataset: MovieLens 100K
    - u.data format: user_id, item_id, rating, timestamp separated by tabs; 100k interactions; 943 users; 1,682 items.
    - u.item format: item_id|title|release_date|…; use item_id and title, optionally year parsed from title; include genres as multi-hot features if possible.

- Goal: Build an in-browser Two-Tower model:
    - User tower: user features (user_id + optional other features) → embedding (MLP)
    - Item tower: item features (item_id + genres) → embedding (MLP)
    - Scoring: dot product between user and item embeddings
    - Loss: sampled-softmax (in-batch negatives) or BPR-style pairwise; simple contrastive loss with in-batch negatives is acceptable for clarity

UX Requirements
- Buttons: “Load Data”, “Train”, “Test”.
- Training: show live loss chart and epoch progress; after training, render 2D projection (PCA or t-SNE via numeric approximation) of a sample of item embeddings.
- Test: 
    - Randomly select a user with ≥20 ratings
    - Show:
        - Left: that user’s top-10 historically rated movies (by rating, then recency)
        - Middle: model’s top-10 recommended movies **without Deep Learning (basic embedding tables)**
        - Right: model’s top-10 recommended movies **with Deep Learning (Two-Tower MLP)**
    - Render as a single side-by-side HTML table
    - Each table has columns: Rank, Movie, Rating/Score, Year
    - Optional: chart or visual comparison for score differences

Constraints
- Pure client-side (no server), runs on GitHub Pages. Fetch u.data and u.item via relative paths (place files under data/).
- Use TensorFlow.js only; no Python, no build step.
- Keep memory in check: allow limiting interactions (e.g., max 80k) and embedding dim (e.g., 32).
- Deterministic seeding optional; browsers vary.

References
- Two-tower retrieval on MovieLens in TF/TFRS (concepts and loss)
- MovieLens 100K format details
- TensorFlow.js in-browser training guidance

Instructions
- Return three files with complete code, each in a separate fenced code block.
- Implement clean, commented JavaScript with clear sections.

a) index.html
- Include:
    - Title and minimal CSS
    - Buttons: Load Data, Train, Test
    - Status area, loss chart canvas, embedding projection canvas
    - <div id="results"> to hold side-by-side comparison tables
    - Scripts: load TensorFlow.js from CDN, then app.js and two-tower.js
- Add usability tips (how long training takes, hosting on GitHub Pages)

b) app.js
- Data loading:
    - Fetch data/u.data and data/u.item with fetch(); parse lines
    - Build:
        - interactions: [{userId, itemId, rating, ts}]
        - items: Map itemId → {title, year, genres}
    - Build user→rated items and user→top-rated (compute once)
    - Create integer indexers for userId and itemId; store reverse maps
- Train pipeline:
    - Build batches: for each (u, i_pos), sample negatives (in-batch or global)
    - Normalize user/item counts; allow config: epochs, batch size, embeddingDim, learningRate, maxInteractions
    - Live line chart of loss per batch/epoch using simple canvas 2D plotter (no external lib)
- Test pipeline:
    - Pick random user with ≥20 ratings
    - Compute user embedding via user tower; compute scores vs all items (batched)
    - Exclude items user already rated
    - Return top-10 historical ratings, top-10 recommendations **without Deep Learning**, top-10 recommendations **with Deep Learning**
    - Render a 3-column side-by-side HTML table; each table has columns: Rank, Movie, Rating/Score, Year
- Visualization:
    - After training, take sample (e.g., 1,000 items), project item embeddings to 2D with PCA (simple SVD approximation) and draw scatter; show titles on hover

c) two-tower.js
- Implement a minimal Two-Tower in TF.js:
    - Class TwoTowerModel:
        - constructor(numUsers, numItems, embDim)
            - User tower: MLP with at least one hidden layer; input = user features
            - Item tower: MLP with at least one hidden layer; input = item features (include genres multi-hot)
        - userForward(userIdxTensor) → embedding
        - itemForward(itemIdxTensor) → embedding
        - score(uEmb, iEmb) → dot product along last dim
    - Loss:
        - Option 1 (default): in-batch sampled softmax; logits = U @ I^T, labels = diagonal; softmax cross-entropy
        - Option 2: BPR pairwise loss; sample negative items; loss = −log σ(score(U, I+) − score(U, I−))
        - Flag to switch
    - Training step:
        - Adam optimizer; gradient tape updates user/item towers
        - Return scalar loss for UI plotting
    - Inference:
        - getUserEmbedding(uIdx)
        - getScoresForAllItems(uEmb, itemEmbMatrix) with batched matmul; return top-K indices
- Comments:
    - Short comments above key blocks: explain two-tower idea, in-batch negatives, why dot product

Format
- Return three code blocks only, labeled exactly:
    - index.html
    - app.js
    - two-tower.js
- No extra prose outside code blocks
- Repository structure:
    - /index.html
    - /app.js
    - /two-tower.js
    - /data/u.data
    - /data/u.item
- UI workflow:
    - Load Data → parse and index
    - Train → run epochs, update loss chart, draw embedding projection
    - Test → pick random qualified user, render 3-column side-by-side table: historical top-10, top-10 without DL, top-10 with DL
