// two-tower.js
// Minimal Two-Tower model for MovieLens 100K

class TwoTowerModel {
  constructor(numUsers, numItems, embDim, numGenres=18) {
    this.numUsers = numUsers;
    this.numItems = numItems;
    this.embDim = embDim;
    this.numGenres = numGenres;

    // User embedding table
    this.userEmbedding = tf.variable(tf.randomNormal([numUsers, embDim], 0, 0.05));

    // Item embedding table
    this.itemEmbedding = tf.variable(tf.randomNormal([numItems, embDim], 0, 0.05));

    // User tower MLP
    this.userMLP = tf.sequential();
    this.userMLP.add(tf.layers.dense({units: embDim, activation: 'relu', inputShape: [embDim]}));
    this.userMLP.add(tf.layers.dense({units: embDim}));

    // Item tower MLP
    this.itemMLP = tf.sequential();
    this.itemMLP.add(tf.layers.dense({units: embDim, activation: 'relu', inputShape: [embDim+numGenres]}));
    this.itemMLP.add(tf.layers.dense({units: embDim}));

    this.optimizer = tf.train.adam(0.01);
  }

  // Forward user embedding
  userForward(userIdx) {
    return tf.tidy(() => {
      let uEmb = tf.gather(this.userEmbedding, userIdx);
      return this.userMLP.apply(uEmb);
    });
  }

  // Forward item embedding (concatenate genres multi-hot)
  itemForward(itemIdx, itemGenres) {
    return tf.tidy(() => {
      let iEmb = tf.gather(this.itemEmbedding, itemIdx);
      let inp = tf.concat([iEmb, itemGenres], -1);
      return this.itemMLP.apply(inp);
    });
  }

  // Dot product scoring
  score(userEmb, itemEmb) {
    return tf.tidy(() => tf.matMul(userEmb, itemEmb, false, true));
  }

  // Training step: simple in-batch sampled softmax
  trainStep(userIdx, posItemIdx, negItemIdx, itemGenres) {
    return tf.tidy(() => {
      return this.optimizer.minimize(() => {
        let uEmb = this.userForward(userIdx);
        let iPosEmb = this.itemForward(posItemIdx, tf.gather(itemGenres, posItemIdx));
        let iNegEmb = this.itemForward(negItemIdx, tf.gather(itemGenres, negItemIdx));

        let posScore = tf.sum(tf.mul(uEmb, iPosEmb), -1);
        let negScore = tf.sum(tf.mul(uEmb, iNegEmb), -1);
        let loss = tf.mean(tf.softplus(negScore.sub(posScore))); // BPR loss
        return loss;
      }, true);
    });
  }

  // Inference: user embedding
  getUserEmbedding(userIdx) {
    return this.userForward(userIdx);
  }

  // Get scores for all items (batched)
  getScoresForAllItems(userEmb, allItemEmb) {
    return tf.tidy(() => {
      return tf.matMul(userEmb, allItemEmb, false, true).arraySync()[0];
    });
  }
}
