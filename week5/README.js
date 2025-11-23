You are asked to implement a PageRank Friend Recommendation App using HTML, D3.js, and TensorFlow.js. The requirements are:

1. Load a default graph from a CSV file (e.g., data/karate.csv) containing nodes and edges with unique numeric IDs.
2. Render an interactive network graph with D3.js, supporting:
   - Force-directed layout
   - Zoom and pan
   - Node drag
   - Node size proportional to PageRank
   - Node color representing PageRank
3. Compute PageRank scores entirely client-side using TensorFlow.js with 50 iterations and a damping factor of 0.85.
4. Display a node table showing:
   - Node ID
   - PageRank score
   - Current friends
   - Table sorted descending by PageRank
5. When a user clicks a node (graph or table):
   - Highlight the node
   - Show node details, including current friends
   - Recommend top 3 new friends by PageRank (excluding existing friends) with a "Connect" button for each
6. Clicking "Connect":
   - Adds a bidirectional edge between nodes
   - Recomputes PageRank
   - Updates both table and graph dynamically
7. Clicking "Reset Graph" restores the original graph and clears all selections.
8. Handle errors gracefully, including CSV loading or PageRank computation issues.
9. All computation and interactions must occur entirely in the browser; no backend or server communication.
10. Maintain clean modular code in 4 files:
    - index.html: unchanged layout and UI/UX
    - app.js: main logic for graph, PageRank, table, selection, and recommendations
    - pagerank.js: TensorFlow.js PageRank computation
    - graph.js: D3.js graph rendering and interaction

The final app must be fully functional, error-free, and exactly match the professor’s UI/UX while implementing all features including table sorting, top 3 friend recommendations, node highlighting, and dynamic PageRank recomputation.
Link page: https://123456789hien.github.io/recsys/week5/
