// pagerank.js
async function computePageRank(nodes, edges, iterations = 50, damping = 0.85) {
    const n = nodes.length;
    const nodeIds = nodes.map(n => Number(n.id));
    const nodeIndex = {};
    nodeIds.forEach((id, idx) => nodeIndex[id] = idx);

    // Initialize adjacency matrix and out-degree
    const M = Array.from({ length: n }, () => Array(n).fill(0));
    const outDegree = Array(n).fill(0);

    edges.forEach(e => {
        const s = nodeIndex[Number(e.source)];
        const t = nodeIndex[Number(e.target)];
        if (s === undefined || t === undefined) return;
        M[t][s] = 1;
        M[s][t] = 1; // undirected
        outDegree[s]++;
        outDegree[t]++;
    });

    // Normalize columns
    for (let j = 0; j < n; j++) {
        if (outDegree[j] === 0) {
            for (let i = 0; i < n; i++) M[i][j] = 1 / n;
        } else {
            for (let i = 0; i < n; i++) M[i][j] /= outDegree[j];
        }
    }

    // TensorFlow computation
    let M_tensor = tf.tensor2d(M);
    let pr = tf.ones([n, 1]).div(tf.scalar(n));
    const dampingTensor = tf.scalar(damping);
    const teleportTensor = tf.scalar((1 - damping) / n);
    const onesTensor = tf.ones([n, 1]);

    for (let i = 0; i < iterations; i++) {
        pr = M_tensor.matMul(pr).mul(dampingTensor).add(onesTensor.mul(teleportTensor));
        pr = pr.div(pr.sum());
    }

    const scoresArray = await pr.array();
    const scores = {};
    nodeIds.forEach((id, idx) => scores[id] = scoresArray[idx][0]);

    // Cleanup
    M_tensor.dispose();
    pr.dispose();
    dampingTensor.dispose();
    teleportTensor.dispose();
    onesTensor.dispose();

    return scores;
}
