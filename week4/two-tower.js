// two-tower.js
class TwoTowerModel {
  constructor(numUsers, numItems, embDim=32){
    this.numUsers = numUsers;
    this.numItems = numItems;
    this.embDim = embDim;

    this.userEmb = tf.variable(tf.randomNormal([numUsers, embDim]));
    this.itemEmb = tf.variable(tf.randomNormal([numItems, embDim]));

    this.userMLP = tf.sequential();
    this.userMLP.add(tf.layers.dense({units: embDim, activation:'relu', inputShape:[embDim]}));
    this.userMLP.add(tf.layers.dense({units: embDim}));

    this.itemMLP = tf.sequential();
    this.itemMLP.add(tf.layers.dense({units: embDim, activation:'relu', inputShape:[embDim]}));
    this.itemMLP.add(tf.layers.dense({units: embDim}));

    this.optimizer = tf.train.adam(0.01);
  }

  userForward(uIdxTensor){
    return tf.tidy(()=>{
      const emb = tf.gather(this.userEmb, uIdxTensor);
      return this.userMLP.apply(emb);
    });
  }

  itemForward(iIdxTensor){
    return tf.tidy(()=>{
      const emb = tf.gather(this.itemEmb, iIdxTensor);
      return this.itemMLP.apply(emb);
    });
  }

  score(uEmb, iEmb){
    return tf.tidy(()=>tf.sum(tf.mul(uEmb,iEmb),1));
  }

  async trainStep(batch, userId2idx, itemId2idx){
    const losses = [];
    await this.optimizer.minimize(()=>{
      const uIdx = tf.tensor1d(batch.map(d=>userId2idx.get(d.userId)),'int32');
      const iIdx = tf.tensor1d(batch.map(d=>itemId2idx.get(d.itemId)),'int32');
      const uEmb = this.userForward(uIdx);
      const iEmb = this.itemForward(iIdx);
      const logits = tf.sum(tf.mul(uEmb,iEmb),1);
      const labels = tf.tensor1d(batch.map(d=>1),'float32'); // simple positive
      const loss = tf.losses.meanSquaredError(labels,logits);
      losses.push(loss.dataSync()[0]);
      return loss;
    });
    return losses[losses.length-1];
  }

  async getItemEmbeddings(iIdxArr){
    const iIdx = tf.tensor1d(iIdxArr,'int32');
    return await this.itemForward(iIdx).array();
  }

  async getScoresForAllItems(uIdx){
    const uEmb = this.userForward(tf.tensor1d([uIdx],'int32'));
    const allI = tf.range(0,this.numItems,'int32');
    const iEmb = this.itemForward(allI);
    const scores = tf.matMul(uEmb,iEmb,true,false).arraySync()[0];
    return scores;
  }
}
