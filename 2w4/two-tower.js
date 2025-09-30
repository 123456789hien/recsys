// two-tower.js
// TwoTowerModel for TF.js — supports baseline (embeddings only) and deep towers (embeddings + Dense layers).
// - Constructor: (numUsers, numItems, embDim, opts)
//    opts.deep = boolean, opts.hiddenUnits = [64,32], opts.dropout = 0.2
// - userForward(itemIdxTensor) -> [batch, embDimOut]
// - itemForward(itemIdxTensor) -> [batch, embDimOut]
// - Provides getUserEmbeddingTensor and getTopK helpers.
// - NOTE: All training is done in app.js using optimizer.minimize and gradients over the variables exposed here.

class TwoTowerModel {
  /**
   * @param {number} numUsers
   * @param {number} numItems
   * @param {number} embDim
   * @param {object} opts
   */
  constructor(numUsers, numItems, embDim, opts = {}){
    this.numUsers = numUsers;
    this.numItems = numItems;
    this.embDim = embDim;
    this.deep = !!opts.deep;
    this.hiddenUnits = opts.hiddenUnits || [64, 32];
    this.dropout = opts.dropout || 0.0;

    // embedding tables (trainable variables)
    const std = 0.05;
    this.userEmbedding = tf.variable(tf.randomNormal([numUsers, embDim], 0, std), true);
    this.itemEmbedding = tf.variable(tf.randomNormal([numItems, embDim], 0, std), true);

    // if deep, create dense layer variables (weights + biases)
    this.denseLayers = [];
    this.denseVars = [];
    if(this.deep){
      // build a sequence of Dense layers mapping embDim -> hiddenUnits... -> outDim
      let inDim = embDim;
      for(let i=0;i<this.hiddenUnits.length;i++){
        const outDim = this.hiddenUnits[i];
        const w = tf.variable(tf.randomNormal([inDim, outDim], 0, Math.sqrt(2/inDim)), true);
        const b = tf.variable(tf.zeros([outDim]), true);
        this.denseLayers.push({w,b,act:'relu'});
        this.denseVars.push(w); this.denseVars.push(b);
        inDim = outDim;
      }
      // final projection to embDim (to keep dot product dims equal)
      const wOut = tf.variable(tf.randomNormal([inDim, embDim], 0, Math.sqrt(2/inDim)), true);
      const bOut = tf.variable(tf.zeros([embDim]), true);
      this.denseLayers.push({w:wOut, b:bOut, act:'linear'});
      this.denseVars.push(wOut); this.denseVars.push(bOut);
    }
  }

  // simple MLP forward for a batch of embeddings (2D tensor)
  _mlpForward(x){ // x: [batch, inDim]
    if(!this.deep) return x;
    return tf.tidy(()=>{
      let out = x;
      for(let i=0;i<this.denseLayers.length;i++){
        const layer = this.denseLayers[i];
        out = tf.add(tf.matMul(out, layer.w), layer.b);
        if(layer.act === 'relu') out = out.relu();
        // apply dropout only during training; app.js uses optimizer.minimize which does not pass training flag,
        // so we optionally rely on tf.keep dropout off (simpler). For clarity, we skip dropout in this minimal demo.
      }
      return out;
    });
  }

  // Gather user embeddings and (optionally) pass through tower MLP
  userForward(userIdxTensor){
    return tf.tidy(()=> {
      const emb = tf.gather(this.userEmbedding, userIdxTensor); // [B, embDim]
      const out = this._mlpForward(emb);
      return out;
    });
  }

  itemForward(itemIdxTensor){
    return tf.tidy(()=>{
      const emb = tf.gather(this.itemEmbedding, itemIdxTensor);
      const out = this._mlpForward(emb);
      return out;
    });
  }

  // Helper: get a single user's embedding tensor [1, embDim] (caller must dispose)
  getUserEmbeddingTensor(userIdx){
    const t = tf.tensor1d([userIdx], 'int32');
    const out = this.userForward(t);
    t.dispose();
    return out;
  }

  // Get top K items for a user (small utility - careful with memory)
  async getTopKForUser(userIdx, K=10){
    const userT = this.getUserEmbeddingTensor(userIdx); // [1,d]
    const logits = tf.matMul(userT, this.itemEmbedding, false, true); // [1, numItems]
    const arr = await logits.data();
    userT.dispose(); logits.dispose();
    const idxs = Array.from(arr.map((v,i)=>({i,v})));
    idxs.sort((a,b)=>b.v - a.v);
    return idxs.slice(0,K).map(x=>x.i);
  }

  // Dispose variables
  dispose(){
    try{
      this.userEmbedding?.dispose();
      this.itemEmbedding?.dispose();
      if(this.denseVars) this.denseVars.forEach(v=>v.dispose());
    } catch(e){}
  }
}

// export to window for app.js
window.TwoTowerModel = TwoTowerModel;

/*
  Design notes:
  - Baseline mode: deep=false. Towers are simply embedding lookups and returned as vectors.
  - Deep mode: deep=true. After lookup, embeddings pass through several Dense layers (ReLU) and final linear projection back to embDim.
  - We keep dot-product scoring (u_emb · i_emb) for retrieval speed and simplicity.
  - Loss functions and training loop are implemented in app.js to allow flexible choice (in-batch softmax or BPR).
  - Variables exposed: userEmbedding, itemEmbedding, and dense variables (denseVars) so optimizer.minimize can update them.
*/
