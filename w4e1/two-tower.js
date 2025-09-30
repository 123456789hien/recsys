// two-tower.js
// -------- Two-Tower Retrieval Model in TF.js --------
class TwoTowerModel{
  constructor(numUsers,numItems,embDim){
    this.embDim=embDim;
    // base embeddings
    this.userBase=tf.variable(tf.randomNormal([numUsers,embDim],0,0.1));
    this.itemBase=tf.variable(tf.randomNormal([numItems,embDim],0,0.1));
    // simple MLP: one hidden layer
    this.userW1=tf.variable(tf.randomNormal([embDim,embDim],0,0.1));
    this.userb1=tf.variable(tf.zeros([embDim]));
    this.itemW1=tf.variable(tf.randomNormal([embDim,embDim],0,0.1));
    this.itemb1=tf.variable(tf.zeros([embDim]));
  }
  // forward pass user tower
  userForward(uIdxTensor){
    let x=tf.gather(this.userBase,uIdxTensor);
    x=tf.relu(tf.add(tf.matMul(x,this.userW1),this.userb1));
    return tf.linalg.l2Normalize(x,-1);
  }
  // forward pass item tower
  itemForward(iIdxTensor){
    let x=tf.gather(this.itemBase,iIdxTensor);
    x=tf.relu(tf.add(tf.matMul(x,this.itemW1),this.itemb1));
    return tf.linalg.l2Normalize(x,-1);
  }
  // score = dot product
  score(uEmb,iEmb){return tf.matMul(uEmb,iEmb,true,false);}
  // training step with in-batch softmax
  trainStep(uIdxTensor,iIdxTensor,opt){
    return opt.minimize(()=>{
      const uEmb=this.userForward(uIdxTensor);
      const iEmb=this.itemForward(iIdxTensor);
      const logits=tf.matMul(uEmb,iEmb,true,false); // [B,B]
      const labels=tf.range(0,uIdxTensor.shape[0],'int32');
      const loss=tf.losses.sparseSoftmaxCrossEntropy(labels,logits);
      return loss;
    },true,[
      this.userBase,this.itemBase,
      this.userW1,this.userb1,this.itemW1,this.itemb1
    ]);
  }
  getAllItemEmbeddings(){
    return tf.tidy(()=>{
      const idx=tf.range(0,this.itemBase.shape[0],1,'int32');
      const emb=this.itemForward(idx);
      idx.dispose();
      return emb;
    });
  }
  getUserEmbedding(uIdx){
    return tf.tidy(()=>{
      const t=tf.tensor1d([uIdx],'int32');
      const e=this.userForward(t);
      return e.squeeze();
    });
  }
  getUserBase(uIdx){
    return tf.tidy(()=>{
      const emb=tf.gather(this.userBase,tf.tensor1d([uIdx],'int32'));
      return emb.squeeze();
    });
  }
}
