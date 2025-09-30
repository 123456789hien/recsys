// two-tower.js
// Two-Tower retrieval model (TF.js). Uses embedding base + MLP towers (not single-line var-only).
// - userBase/itemBase: small trainable base vectors (memory-efficient vs full one-hot MLP).
// - user/item towers: MLP (Dense layers) projecting to final embDim, L2-normalized.

function denseLayer(x, W, b, act = null) {
  const y = tf.add(tf.matMul(x, W), b);
  return act ? act(y) : y;
}

class TwoTowerModel {
  /**
   * numUsers, numItems: ints
   * embDim: final embedding dimensionality
   * opts: { mlpHidden: [..] }
   */
  constructor(numUsers, numItems, embDim, opts = {}) {
    this.numUsers = numUsers;
    this.numItems = numItems;
    this.embDim = embDim;
    this.mlpHidden = opts.mlpHidden || [128, 64];

    const std = 0.05;
    // base lookup tables: small vectors per id; then pass through MLP.
    this.userBase = tf.variable(tf.randomNormal([numUsers, embDim], 0, std));
    this.itemBase = tf.variable(tf.randomNormal([numItems, embDim], 0, std));

    // user MLP params
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
    this.userFinal = {
      W: tf.variable(tf.randomNormal([prev, embDim], 0, Math.sqrt(2/(prev+embDim)))),
      b: tf.variable(tf.zeros([embDim])),
      act: null
    };

    // item MLP params
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

    // Note: final outputs will be L2-normalized vectors (helps dot-product stability)
  }

  // userForward: userIdxTensor int32 shape [N] -> returns tensor [N, embDim]
  userForward(userIdxTensor) {
    // gather base embeddings
    const base = tf.gather(this.userBase, userIdxTensor); // [N, embDim]
    let h = base;
    for (const layer of this.userMlps) h = denseLayer(h, layer.W, layer.b, layer.act);
    h = denseLayer(h, this.userFinal.W, this.userFinal.b, this.userFinal.act);
    const norm = tf.maximum(tf.norm(h, 'euclidean', 1, true), 1e-6);
    return tf.div(h, norm);
  }

  // itemForward: itemIdxTensor int32 shape [M] -> returns [M, embDim]
  itemForward(itemIdxTensor) {
    const base = tf.gather(this.itemBase, itemIdxTensor);
    let h = base;
    for (const layer of this.itemMlps) h = denseLayer(h, layer.W, layer.b, layer.act);
    h = denseLayer(h, this.itemFinal.W, this.itemFinal.b, this.itemFinal.act);
    const norm = tf.maximum(tf.norm(h, 'euclidean', 1, true), 1e-6);
    return tf.div(h, norm);
  }

  // return a user embedding tensor for a single user index (do NOT dispose it here)
  getUserEmbeddingTensor(uIdx) {
    const t = tf.tensor1d([uIdx], 'int32');
    const emb = this.userForward(t); // [1, D]
    t.dispose();
    // return as [D] vector
    return emb.reshape([this.embDim]);
  }

  // helper: compute all item embeddings (may be large); returns promise of array
  async getAllItemEmbeddings() {
    const idxs = tf.tensor1d([...Array(this.numItems).keys()], 'int32');
    const E = this.itemForward(idxs);
    const arr = await E.array();
    idxs.dispose(); E.dispose();
    return arr;
  }

  // topK from JS scores array
  topKFromScores(scores, K=10) {
    const pairs = scores.map((s,i)=> ({s,i}));
    pairs.sort((a,b)=> b.s - a.s);
    return pairs.slice(0,K).map(p=>p.i);
  }
}

// expose globally
window.TwoTowerModel = TwoTowerModel;
