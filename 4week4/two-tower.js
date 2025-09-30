// two-tower.js
// Two-Tower model implemented in TensorFlow.js
// - User tower: user-id base embedding -> MLP -> embedding
// - Item tower: item-id base embedding + genres multi-hot -> MLP -> embedding
// - Score: dot product between user/item embeddings
// - Loss: in-batch softmax (default) or BPR pairwise (switchable)
// Notes: we avoid tf.linalg.l2Normalize (not present) and normalize by dividing by norm.

// ----------------- Utilities -----------------
function randInt(max) { return Math.floor(Math.random()*max); }
function makeVar(shape, std=0.05) { return tf.variable(tf.randomNormal(shape, 0, std)); }

// ----------------- TwoTowerModel -----------------
class TwoTowerModel {
  /**
   * @param {number} numUsers
   * @param {number} numItems
   * @param {number} embDim final embedding dimension
   * @param {number} numGenres number of genre flags (0 if none)
   * @param {object} opts { userHidden:[..], itemHidden:[..] }
   */
  constructor(numUsers, numItems, embDim=32, numGenres=0, opts={}) {
    this.numUsers = numUsers;
    this.numItems = numItems;
    this.embDim = embDim;
    this.numGenres = numGenres || 0;
    this.userHidden = opts.userHidden || [128, 64];  // at least one hidden layer
    this.itemHidden = opts.itemHidden || [128, 64];

    // base id lookup vectors (trainable)
    this.userBase = makeVar([numUsers, embDim], 0.05);
    this.itemBase = makeVar([numItems, embDim], 0.05);

    // optional genres tensor (set later via setItemGenres)
    this.itemGenres = null; // tf.tensor2d shape [numItems, numGenres]

    // build MLP params for user tower
    this.userWeights = []; this.userBiases = [];
    let prev = embDim;
    for (let h of this.userHidden) {
      this.userWeights.push(makeVar([prev, h], Math.sqrt(2/(prev+h))));
      this.userBiases.push(tf.variable(tf.zeros([h])));
      prev = h;
    }
    // final to embDim
    this.userWeights.push(makeVar([prev, embDim], Math.sqrt(2/(prev+embDim))));
    this.userBiases.push(tf.variable(tf.zeros([embDim])));

    // build MLP params for item tower
    this.itemWeights = []; this.itemBiases = [];
    prev = embDim + this.numGenres;
    for (let h of this.itemHidden) {
      this.itemWeights.push(makeVar([prev, h], Math.sqrt(2/(prev+h))));
      this.itemBiases.push(tf.variable(tf.zeros([h])));
      prev = h;
    }
    // final
    this.itemWeights.push(makeVar([prev, embDim], Math.sqrt(2/(prev+embDim))));
    this.itemBiases.push(tf.variable(tf.zeros([embDim])));

    // collect trainable vars for optimizer
    this._trainableVars = [
      this.userBase, this.itemBase,
      ...this.userWeights, ...this.userBiases,
      ...this.itemWeights, ...this.itemBiases
    ];
    // optimizer will be set on compile()
    this.optimizer = null;
  }

  // set genres matrix (array of arrays) length = numItems, width = numGenres
  setItemGenres(genresArr) {
    if (!this.numGenres || !genresArr) return;
    if (this.itemGenres) this.itemGenres.dispose();
    this.itemGenres = tf.tensor2d(genresArr, [this.numItems, this.numGenres], 'float32');
  }

  compile(learningRate=0.005) {
    this.optimizer = tf.train.adam(learningRate);
  }

  // helper: apply MLP weights (weights[], biases[])
  _applyMLP(x, weights, biases) {
    let h = x;
    for (let i=0;i<weights.length;i++) {
      h = tf.add(tf.matMul(h, weights[i]), biases[i]);
      // use ReLU for all hidden layers; final layer (i==weights.length-1) linear
      if (i < weights.length - 1) h = tf.relu(h);
    }
    return h;
  }

  // L2 normalize along last axis. returns tensor with same shape as x
  _l2Normalize(x) {
    // axis=1 (row-wise), keepDims=true for broadcasting
    const eps = 1e-10;
    const norm = x.norm('euclidean', 1, true).add(eps);
    return x.div(norm);
  }

  // userForward: userIdxTensor int32 shape [B] -> [B, embDim]
  userForward(userIdxTensor) {
    const base = tf.gather(this.userBase, userIdxTensor); // [B, embDim]
    const out = this._applyMLP(base, this.userWeights, this.userBiases); // [B, embDim]
    return this._l2Normalize(out);
  }

  // itemForward: itemIdxTensor int32 shape [M] -> [M, embDim]
  itemForward(itemIdxTensor) {
    const base = tf.gather(this.itemBase, itemIdxTensor); // [M, embDim]
    let inVec = base;
    if (this.itemGenres) {
      const g = tf.gather(this.itemGenres, itemIdxTensor); // [M, numGenres]
      inVec = tf.concat([base, g], 1); // [M, embDim + numGenres]
      g.dispose();
    }
    const out = this._applyMLP(inVec, this.itemWeights, this.itemBiases);
    if (inVec !== base) inVec.dispose();
    return this._l2Normalize(out);
  }

  // score: uEmb [B,D], iEmb [M,D] -> logits [B,M] (we will mostly use [N,N] in-batch)
  score(uEmb, iEmb) {
    return tf.matMul(uEmb, iEmb, false, true);
  }

  // get trainable vars
  trainableVars() { return this._trainableVars.slice(); }

  // Train step: uIdxTensor, iIdxTensor are int32 1D tensors (length N)
  // if useBPR true -> BPR pairwise loss; else in-batch softmax cross-entropy
  async trainStep(uIdxTensor, iIdxTensor, useBPR=false) {
    if (!this.optimizer) throw new Error('Call compile(lr) before training');
    // minimize returns a scalar tensor; wrap computation in tf.tidy for safety
    const lossTensor = this.optimizer.minimize(() => tf.tidy(() => {
      const U = this.userForward(uIdxTensor); // [N,D]
      const P = this.itemForward(iIdxTensor); // [N,D]
      let loss;
      if (useBPR) {
        // sample negatives uniformly
        const N = U.shape[0];
        const neg = tf.tensor1d(new Int32Array(Array.from({length:N}, ()=>randInt(this.numItems))), 'int32');
        const Nn = this.itemForward(neg); // [N,D]
        const posScore = tf.sum(tf.mul(U, P), 1); // [N]
        const negScore = tf.sum(tf.mul(U, Nn), 1); // [N]
        const diff = tf.sub(posScore, negScore);
        const sig = tf.sigmoid(diff);
        loss = tf.neg(tf.mean(tf.log(sig.add(1e-8))));
        neg.dispose(); Nn.dispose(); posScore.dispose(); negScore.dispose(); diff.dispose(); sig.dispose();
      } else {
        // in-batch softmax cross-entropy: logits = U @ P^T, labels = identity
        const logits = tf.matMul(U, P, false, true); // [N,N]
        const logp = tf.logSoftmax(logits); // [N,N]
        const labels = tf.eye(logits.shape[0]); // [N,N]
        const perEx = tf.neg(tf.sum(tf.mul(labels, logp), 1)); // [N]
        loss = tf.mean(perEx);
        logits.dispose(); logp.dispose(); labels.dispose(); perEx.dispose();
      }
      U.dispose(); P.dispose();
      return loss;
    }), true, this.trainableVars());

    const val = (await lossTensor.data())[0];
    lossTensor.dispose();
    // allow event loop to breathe
    await tf.nextFrame();
    return val;
  }

  // ---------- Inference helpers ----------

  // return base user embedding array (no MLP) for baseline
  async getUserBaseEmbedding(uIdx) {
    const t = tf.tensor1d([uIdx], 'int32');
    const e = tf.gather(this.userBase, t); // [1, D]
    const arr = await e.array();
    t.dispose(); e.dispose();
    return arr[0];
  }

  // return all base item embeddings array (no MLP)
  async getAllItemBaseEmbeddings() {
    const arr = await this.itemBase.array();
    return arr; // [numItems][D]
  }

  // return MLP user embedding (array)
  async getUserEmbedding(uIdx) {
    const t = tf.tensor1d([uIdx], 'int32');
    const e = this.userForward(t); // [1,D]
    const arr = await e.array();
    t.dispose(); e.dispose();
    return arr[0];
  }

  // return ALL item embeddings (MLP)
  async getAllItemEmbeddings() {
    // produce indices tensor for all items in chunks to avoid huge memory
    const CHUNK = 2048;
    const out = [];
    for (let start=0; start < this.numItems; start += CHUNK) {
      const end = Math.min(this.numItems, start + CHUNK);
      const idx = new Int32Array(end - start);
      for (let i=start;i<end;i++) idx[i-start] = i;
      const idxT = tf.tensor1d(idx, 'int32');
      const e = this.itemForward(idxT);
      const arr = await e.array();
      out.push(...arr);
      idxT.dispose(); e.dispose();
      await tf.nextFrame();
    }
    return out; // [numItems][D]
  }

  // get scores for a user against all items (batched) -> Float32Array length numItems
  async getScoresForUser(uIdx, chunkSize=1024) {
    const uT = tf.tensor1d([uIdx], 'int32');
    const uEmb = this.userForward(uT); // [1,D]
    const uEmbRow = uEmb.reshape([1, this.embDim]); // [1,D]
    const out = new Float32Array(this.numItems);
    for (let start=0; start < this.numItems; start += chunkSize) {
      const end = Math.min(this.numItems, start + chunkSize);
      const idx = new Int32Array(end - start);
      for (let i=start;i<end;i++) idx[i-start] = i;
      const idxT = tf.tensor1d(idx, 'int32');
      const itemE = this.itemForward(idxT); // [M,D]
      // scores = itemE @ uEmb^T -> [M,1]
      const prod = tf.sum(tf.mul(itemE, uEmbRow), 1); // [M]
      const arr = await prod.data();
      for (let k=0;k<arr.length;++k) out[start+k] = arr[k];
      idxT.dispose(); itemE.dispose(); prod.dispose();
      await tf.nextFrame();
    }
    uT.dispose(); uEmb.dispose(); uEmbRow.dispose();
    return out;
  }
}

// export to window for app.js to use
window.TwoTowerModel = TwoTowerModel;
