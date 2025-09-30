Context

Dataset: MovieLens 100K

u.data: user_id, item_id, rating, timestamp (tab-separated).

u.item: item_id|title|release_date|… (use item_id, title, and optional year).

Goal:

Build a browser-based Two-Tower Deep Learning model:

User tower: user_id → embedding → Dense layers (ReLU, Dropout) → user representation.

Item tower: item_id → embedding → Dense layers (ReLU, Dropout) → item representation.

Scoring: dot product of final representations.

Loss: in-batch softmax (default) or BPR.

New Requirement: Add comparison between baseline (simple embedding two-tower) and deep learning two-tower.

Train and log both models.

Plot a chart showing training loss curves of baseline vs deep model.

UX Requirements

UI theme: centered, pink-white color palette, cute but professional, balanced layout.

Buttons: Load Data, Train, Test.

Status area and loss chart canvas.

Embedding projection canvas after training.

Results div: show side-by-side HTML table (Top-10 rated vs Top-10 recommended).

Comparison chart: show loss curves of baseline vs deep learning two-tower (two lines, clearly labeled).

Constraints

Pure client-side (no server), runs on GitHub Pages.

Fetch /data/u.data and /data/u.item via relative paths.

Use TensorFlow.js only.

Keep memory in check (limit interactions, embedding dim).

Instructions

Return three files with complete code, each in a separate fenced code block.

a) index.html

Title and minimal CSS (pink-white theme, centered, balanced, cute but professional).

Buttons: Load Data, Train, Test.

Areas: status, loss chart, embedding projection, results table, comparison chart.

Load TensorFlow.js from CDN, then app.js and two-tower.js.

b) app.js

Data loading: parse u.data and u.item; build interactions, items, user→rated items, top rated.

Train pipeline:

Run both baseline and deep two-tower models.

Track and plot live loss curves.

After training, draw embedding projection (PCA).

Test pipeline:

Pick a random user (≥20 ratings).

Show Top-10 historical movies (left) vs Top-10 recommendations (right).

Visualization:

Loss chart during training.

Comparison chart: baseline vs deep model losses.

Embedding scatterplot.

c) two-tower.js

Implement class TwoTowerModel:

Constructor: (numUsers, numItems, embDim, deep=false).

User tower: embedding → (optional Dense layers if deep=true).

Item tower: same.

Score: dot product.

Loss: in-batch softmax (default) or BPR.

Training step with Adam optimizer.

Inference: user embedding + scores for all items.

Provide both baseline mode (embeddings only) and deep mode (embeddings + dense layers).

Output Format

Return three code blocks only, labeled exactly:

index.html

app.js

two-tower.js

No extra prose outside the code blocks.

👉 Đây là prompt chuẩn, nếu bạn dùng sẽ si
