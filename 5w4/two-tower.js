// two-tower.js
// Two-Tower model for TF.js using embedding lookup + MLP towers (not just raw table vars).
// - Each tower: embedding lookup -> MLP Dense layers -> final projection (L2-normalized).
// - Loss handled in app.js (in-batch softmax or BPR), but helper forward methods provided.

/* Helper dense function uses tf.matMul + bias */
function denseLayer(x, W, b, activation = null) {
  const y = tf.add(tf.matMul(x, W), b);
  return activation ? activation(y) : y;
}

class TwoTowerModel {
  /**
   * numUsers, numItems: integers
   * embDim: final embedding dim
   * opts: { mlpHidden: [..] }
   */
  constructor(numUsers, numItems, embDim, opts = {}) {
    this.numUsers = numUsers;
    this.numItems = numItems;
    this.embDim = embDim;
    this.mlpHidden = opts.mlpHidden || [128, 64];

    // Base embedding tables (trainable) -> small dense vectors that feed the MLP.
    // Using embeddings + MLP is memory efficient vs full one-hot MLP.
    const std = 0.05;
    this.userBase = tf.variable(tf.randomNormal([numUsers, embDim], 0, std));
    this.itemBase = tf.variable(tf.randomNormal([numItems, embDim], 0, std));

    // Build user MLP params
    this.userMlps = [];
    let prev = embDim;
    for (let i=0;i<this.mlpHidden.length;++i) {
      const h = this.mlpHidden[i];
      this.userMlps.push({
        W: tf.variable(tf.randomNormal([prev, h], 0, Math.sqrt(2/(prev+h)))),
        b: tf.variable(tf.zeros([h])),
        act: tf.relu
      });
      prev = h;
    }
    // final projection to embDim
    this.userFinal = {
      W: tf.variable(tf.randomNormal([prev, embDim], 0, Math.sqrt(2/(prev+embDim)))),
      b: tf.variable(tf.zeros([embDim])),
      act: null
    };

    // Build item MLP params (separate)
    this.itemMlps = [];
    prev = embDim;
    for (let i=0;i<this.mlpHidden.length;++i) {
      const h = this.mlpHidden[i];
      this.itemMlps.push({
        W: tf.variable(tf.randomNormal([prev, h], 0, Math.sqrt(2/(prev+h)))),
        b: tf.variable(tf.zeros([h])),
        act: tf.relu
      });
      prev = h;
    }
    this.itemFinal = {
      W: tf.variable(tf.randomNormal([prev, embDim], 0, Math.sqrt(2/(prev+embDim)))),
      b: tf.variable(tf.zeros([embDim])),
      act: null
    };

    // Note: We keep base embedding tables so we don't feed full one-hot vectors to MLP,
    // which would be heavy. This matches the "MLP instead of 3-line naive variables" requirement:
    // we don't use a raw userEmbedding/itemEmbedding as final outputs — we pass them through MLPs.
  }

  // userForward: input userIdxTensor (int32, shape [N]) -> returns [N, D] normalized embeddings
  userForward(userIdxTensor) {
    // embed lookup
    const base = tf.gather(this.userBase, userIdxTensor); // [N, embDim]
    let h = base;
    for (const layer of this.userMlps) {
      h = denseLayer(h, layer.W, layer.b, layer.act);
    }
    h = denseLayer(h, this.userFinal.W, this.userFinal.b, this.userFinal.act);
    // L2 normalize along last axis for stable dot-product retrieval
    const norm = tf.maximum(tf.norm(h, 'euclidean', 1, true), 1e-6);
    return tf.div(h, norm);
  }

  // itemForward: input itemIdxTensor -> [N, D]
  itemForward(itemIdxTensor) {
    const base = tf.gather(this.itemBase, itemIdxTensor);
    let h = base;
    for (const layer of this.itemMlps) {
      h = denseLayer(h, layer.W, layer.b, layer.act);
    }
    h = denseLayer(h, this.itemFinal.W, this.itemFinal.b, this.itemFinal.act);
    const norm = tf.maximum(tf.norm(h, 'euclidean', 1, true), 1e-6);
    return tf.div(h, norm);
  }

  // convenience: return user embedding (tf.Tensor1d of length embDim) for single index
  getUserEmbeddingTensor(uIdx) {
    const t = tf.tensor1d([uIdx], 'int32');
    const emb = this.userForward(t); // [1,D]
    const out = emb.reshape([this.embDim]);
    t.dispose(); emb.dispose();
    return out;
  }

  // Optional helper: compute all item embeddings (may be heavy)
  async getAllItemEmbeddings() {
    const idxs = tf.tensor1d([...Array(this.numItems).keys()], 'int32');
    const E = this.itemForward(idxs);
    const arr = await E.array();
    idxs.dispose(); E.dispose();
    return arr; // [[D], ...]
  }

  // topK via scores array helps when item scores already computed
  topKFromScores(scores, K=10) {
    const pairs = scores.map((s,i)=> ({ s, i }));
    pairs.sort((a,b)=> b.s - a.s);
    return pairs.slice(0,K).map(x=> x.i);
  }

} // end TwoTowerModel

// expose globally
window.TwoTowerModel = TwoTowerModel;
