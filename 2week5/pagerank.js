// pagerank.js
async function computePageRank(nodes, edges, damping = 0.85, steps = 50) {
    const N = nodes.length;
    const nodeIndex = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
    const adj = Array.from({ length: N }, () => new Set());

    edges.forEach(e => {
        adj[nodeIndex[e.source]].add(nodeIndex[e.target]);
        adj[nodeIndex[e.target]].add(nodeIndex[e.source]);
    });

    let pr = tf.fill([N], 1 / N);

    for (let iter = 0; iter < steps; iter++) {
        let newPR = tf.fill([N], (1 - damping) / N);
        const prData = await pr.data();

        for (let i = 0; i < N; i++) {
            const neighbors = Array.from(adj[i]);
            if (neighbors.length > 0) {
                const contribution = (damping * prData[i]) / neighbors.length;
                neighbors.forEach(j => {
                    newPR = tf.tidy(() => {
                        const updated = newPR.bufferSync();
                        updated.set(updated.get(j) + contribution, j);
                        return updated.toTensor();
                    });
                });
            }
        }
        pr.dispose();
        pr = newPR;
    }

    const prResult = await pr.data();
    pr.dispose();

    const scores = {};
    nodes.forEach((n, i) => {
        scores[n.id] = prResult[i];
    });
    return scores;
}
