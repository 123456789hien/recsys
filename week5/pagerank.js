// pagerank.js
// Implements iterative PageRank using TensorFlow.js

export async function computePageRank(nodes, edges, damping = 0.85, steps = 40) {
  const N = nodes.length;
  const idToIndex = new Map(nodes.map((n, i) => [n.id, i]));

  // Build adjacency matrix
  const adj = Array.from({ length: N }, () => Array(N).fill(0));
  edges.forEach(e => {
    const s = idToIndex.get(e.source);
    const t = idToIndex.get(e.target);
    if (s !== undefined && t !== undefined) {
      adj[s][t] = 1;
      adj[t][s] = 1; // undirected graph
    }
  });

  const outDegrees = adj.map(row => row.reduce((a, b) => a + b, 0));

  // Initialize PageRank vector
  let pr = tf.fill([N], 1 / N);

  for (let iter = 0; iter < steps; iter++) {
    pr = tf.tidy(() => {
      let newPr = tf.fill([N], (1 - damping) / N);
      return tf.tensor(Array.from({ length: N }, (_, j) => {
        let sum = 0;
        for (let i = 0; i < N; i++) {
          if (adj[i][j] > 0 && outDegrees[i] > 0) {
            sum += pr.arraySync()[i] / outDegrees[i];
          }
        }
        return (1 - damping) / N + damping * sum;
      }));
    });
    await tf.nextFrame();
  }

  const scores = await pr.array();
  pr.dispose();
  return scores;
}
