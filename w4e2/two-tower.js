// two-tower.js
// ------------------------------------------------------------
// Minimal Two-Tower retrieval model in TF.js

class TwoTowerModel {
  constructor(numUsers, numItems, embDim=32){
    this.embDim = embDim;

    // Base embeddings
    this.userBase = tf.variable(tf.randomNormal([numUsers, embDim],0,0.05));
    this.itemBase = tf.variable(tf.randomNormal([numItems, embDim],0,0.05));

    // simple MLP for user tower
    this.userW1 = tf.variable(tf.randomNormal([embDim, embDim],0,0.05));
    this.userB1 = tf.variable(tf.zeros([embDim]));

    // simple MLP for item tower
    this.itemW1 = tf.variable(tf.randomNormal([embDim, embDim],0,0.05));
    this.itemB1 = tf.variable(tf.zeros([embDim]));
  }

  compile(lr){
    this.optimizer = tf.train.adam(lr);
  }

  // forward through user tower
  userForward(idxTensor){
    const base = tf.gather(this.userBase, idxTensor);  // [B, D]
    const h = tf.relu(tf.add(tf.matMul(base, this.userW1), this.userB1));
    return tf.linalg.l2Normalize(h, -1);
  }

  // forward through item tower
  itemForward(idxTensor){
    const base = tf.gather(this.itemBase, idxTensor); // [B, D]
    const h = tf.relu(tf.add(tf.matMul(base, this.itemW1), this.itemB1));
    return tf.linalg.l2Normalize(h, -1);
  }

  // dot product scores
  score(uEmb, iEmb){
    return tf.matMul(uEmb, iEmb, false, true);
  }

  // in-batch softmax loss
  lossInBatch(uEmb, iEmb){
    const logits = this.score(uEmb, iEmb);          // [B, B]
    const labels = tf.range(0, logits.shape[0],'int32');
    return tf.losses.softmaxCrossEntropy(labels, logits);
  }

  async trainStep(uIdxTensor, iIdxTensor){
    const lossVal = this.optimizer.minimize(()=>{
      const uEmb = this.userForward(uIdxTensor);
      const iEmb = this.itemForward(iIdxTensor);
      return this.lossInBatch(uEmb, iEmb);
    }, true, [
      this.userBase, this.itemBase,
      this.userW1, this.userB1,
      this.itemW1, this.itemB1
    ]);
    return (await lossVal.data())[0];
  }

  // Inference helpers
  async getUserBaseEmbedding(uIdx){
    const t = tf.tensor1d([uIdx],'int32');
    const e = tf.gather(this.userBase, t);
    const arr = await e.array();
    t.dispose(); e.dispose();
    return arr[0];
  }

  async getAllItemBaseEmbeddings(){
    const e = this.itemBase;
    const arr = await e.array();
    return arr;
  }

  async getUserEmbedding(uIdx){
    const t = tf.tensor1d([uIdx],'int32');
    const e = this.userForward(t);
    const arr = await e.array();
    t.dispose(); e.dispose();
    return arr[0];
  }

  async getAllItemEmbeddings(){
    const idx = tf.tensor1d([...Array(this.itemBase.shape[0]).keys()],'int32');
    const e = this.itemForward(idx);
    const arr = await e.array();
    idx.dispose(); e.dispose();
    return arr;
  }
}
