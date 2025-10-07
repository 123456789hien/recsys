You are asked to implement a PageRank Friend Recommendation App using HTML, D3.js, and TensorFlow.js, maintaining the exact UI/UX as provided in the original HTML. The app should:

Load default graph data from a CSV file (e.g., data/karate.csv) representing nodes and edges. Each node has a unique numeric ID.

Display an interactive network graph with D3.js, including:

Force-directed layout

Zoom and pan support

Drag nodes to reposition

Node size proportional to PageRank

Node color indicating PageRank

Compute PageRank scores using TensorFlow.js on the client side with default parameters (50 iterations, damping factor 0.85).

Populate a node table showing:

Node ID

PageRank score

Current friends

Table sorted descending by PageRank

When a user clicks a node in the graph or table:

Highlight the selected node

Show node details in the panel, including current friends

Recommend top 3 new friends by PageRank (excluding existing friends) with a “Connect” button for each

Clicking “Connect”:

Adds a bidirectional edge to the graph

Recomputes PageRank dynamically

Updates the table and graph visualization

Clicking Reset Graph restores the original default graph and clears all selections.

All features must work entirely client-side, without backend or server connections.

Handle any errors gracefully in the console and via alerts (e.g., CSV loading failure or PageRank computation errors).

Maintain exact UI/UX, styling, layout, and controls from the original HTML provided by the professor.
