// two-tower.js
class TwoTowerModel {
  constructor(numUsers,numItems,embDim, itemsMap, learningRate=0.01){
    this.numUsers=numUsers; this.numItems=numItems; this.embDim=embDim;
    this.itemsMap = itemsMap;
    this.optimizer = tf.train.adam(learningRate);

    // User embedding + MLP
    this.userEmbedding = tf.variable(tf.randomNormal([numUsers, embDim]));
    this.userMLP = tf.sequential();
    this.userMLP.add(tf.layers.dense({units:embDim, activation:'relu', inputShape:[embDim]}));

    // Item embedding + MLP
    const genreDim = itemsMap.values().next().value.genres.length;
    this.itemEmbedding = tf.variable(tf.randomNormal([numItems, embDim + genreDim]));
    this.itemMLP = tf.sequential();
    this.itemMLP.add(tf.layers.dense({units:embDim, activation:'relu', inputShape:[embDim + genreDim]}));
  }

  userForward(uIdxTensor){
    return tf.tidy(()=>{
      const emb = tf.gather(this.userEmbedding,uIdxTensor);
      return this.userMLP.apply(emb);
    });
  }

  itemForward(iIdxTensor){
    return tf.tidy(()=>{
      const embeddings = tf.gather(this.itemEmbedding,iIdxTensor);
      return this.itemMLP.apply(embeddings);
    });
  }

  score(uEmb, iEmb){
    return tf.matMul(uEmb,iEmb.transpose());
  }

  async trainStep(batch, userId2Idx, itemId2Idx){
    return tf.tidy(()=>{
      const uIdxs = tf.tensor1d(batch.map(d=>userId2Idx[d.userId]),'int32');
      const iIdxs = tf.tensor1d(batch.map(d=>itemId2Idx[d.itemId]),'int32');

      const lossFn = ()=>{
        const uEmb = this.userForward(uIdxs);
        const iEmb = this.itemForward(iIdxs);
        const logits = tf.sum(tf.mul(uEmb,iEmb),1);
        const labels = tf.ones([logits.shape[0]]);
        const loss = tf.losses.meanSquaredError(labels, logits);
        return loss;
      };

      const grads = tf.variableGrads(lossFn);
      this.optimizer.applyGradients(grads.grads);
      Object.values(grads.grads).forEach(g=>g.dispose());
      const lossVal = lossFn().dataSync()[0];
      return lossVal;
    });
  }

  async getItemEmbeddings(itemIndices){
    return tf.tidy(()=>{
      const iIdxs = tf.tensor1d(itemIndices,'int32');
      const emb = this.itemForward(iIdxs);
      return emb.arraySync();
    });
  }

  async recommendForUser(uIdx, topK=10){
    return tf.tidy(()=>{
      const uEmb = this.userForward(tf.tensor1d([uIdx],'int32'));
      const allIdxs = tf.tensor1d([...Array(this.numItems).keys()],'int32');
      const iEmb = this.itemForward(allIdxs);
      const scores = tf.matMul(uEmb,iEmb.transpose()).dataSync();
      const scored = scores.map((s,i)=>[this.itemsMap.get(i+1).title,s,this.itemsMap.get(i+1).year]);
      scored.sort((a,b)=>b[1]-a[1]);
      return scored.slice(0,topK);
    });
  }
}
