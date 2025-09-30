// two-tower.js
// Two-Tower model with optional MLP for Deep Learning
class TwoTowerModel {
    constructor(numUsers,numItems,embDim,useMLP=true){
        this.useMLP = useMLP;
        this.embDim = embDim;
        if (useMLP) {
            // Deep Learning MLP towers
            this.userEmb = tf.sequential();
            this.userEmb.add(tf.layers.embedding({inputDim:numUsers,outputDim:embDim}));
            this.userEmb.add(tf.layers.flatten());
            this.userEmb.add(tf.layers.dense({units:embDim,activation:'relu'}));

            this.itemEmb = tf.sequential();
            this.itemEmb.add(tf.layers.embedding({inputDim:numItems,outputDim:embDim}));
            this.itemEmb.add(tf.layers.flatten());
            this.itemEmb.add(tf.layers.dense({units:embDim,activation:'relu'}));
        } else {
            // Simple embedding tables
            this.userTable = tf.variable(tf.randomNormal([numUsers,embDim],0,0.05));
            this.itemTable = tf.variable(tf.randomNormal([numItems,embDim],0,0.05));
        }
        this.optimizer = tf.train.adam(0.01);
    }

    userForward(uidTensor){
        if (this.useMLP) return this.userEmb.apply(uidTensor);
        else return tf.gather(this.userTable, uidTensor);
    }
    itemForward(iidTensor){
        if (this.useMLP) return this.itemEmb.apply(iidTensor);
        else return tf.gather(this.itemTable, iidTensor);
    }

    score(uEmb,iEmb){ return tf.sum(tf.mul(uEmb,iEmb),1); }

    async trainStep(batch){
        const uidTensor = tf.tensor1d(batch.map(d=>d.userId),"int32");
        const iidTensor = tf.tensor1d(batch.map(d=>d.itemId),"int32");
        const loss = await this.optimizer.minimize(()=>{
            const uE = this.userForward(uidTensor);
            const iE = this.itemForward(iidTensor);
            const logits = tf.sum(tf.mul(uE,iE),1);
            return tf.neg(tf.mean(logits));
        },true);
        return loss.dataSync()[0];
    }

    async getTopK(uid,k){
        const uidTensor = tf.tensor1d([uid],"int32");
        const uE = this.userForward(uidTensor);
        let scores=[];
        const batchSize=256;
        for (let start=0; start<this.itemTable?this.itemTable.shape[0]:1000; start+=batchSize){
            const end=Math.min(start+batchSize,this.itemTable?this.itemTable.shape[0]:1000);
            const iIdx = tf.tensor1d([...Array(end-start).keys()].map(x=>x+start),"int32");
            const iE = this.itemForward(iIdx);
            const s = tf.matMul(uE,iE.transpose());
            scores.push(s.dataSync());
        }
        scores = [].concat(...scores);
        let idxs = scores.map((v,i)=>[i,v]).sort((a,b)=>b[1]-a[1]).slice(0,k).map(d=>d[0]);
        return idxs;
    }

    async itemEmbeddingsForIndices(idxs){
        const t = tf.tensor1d(idxs,"int32");
        return this.itemForward(t);
    }
}
