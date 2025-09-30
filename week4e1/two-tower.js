// two-tower.js
class TwoTowerModel {
    constructor(numUsers,numItems,embDim,useDeep=false){
        this.numUsers=numUsers;
        this.numItems=numItems;
        this.embDim=embDim;
        this.useDeep=useDeep;

        if(useDeep){
            // User tower: Embedding -> Flatten -> Dense ReLU -> Dense
            this.userEmb = tf.sequential();
            this.userEmb.add(tf.layers.embedding({inputDim:numUsers, outputDim:embDim, inputLength:1}));
            this.userEmb.add(tf.layers.flatten());
            this.userEmb.add(tf.layers.dense({units:embDim*2, activation:'relu'}));
            this.userEmb.add(tf.layers.dense({units:embDim}));

            // Item tower: Embedding -> Flatten -> Dense ReLU -> Dense
            this.itemEmb = tf.sequential();
            this.itemEmb.add(tf.layers.embedding({inputDim:numItems, outputDim:embDim, inputLength:1}));
            this.itemEmb.add(tf.layers.flatten());
            this.itemEmb.add(tf.layers.dense({units:embDim*2, activation:'relu'}));
            this.itemEmb.add(tf.layers.dense({units:embDim}));
        }else{
            // Simple embeddings only
            this.userEmb = tf.sequential();
            this.userEmb.add(tf.layers.embedding({inputDim:numUsers, outputDim:embDim, inputLength:1}));
            this.userEmb.add(tf.layers.flatten());
            this.itemEmb = tf.sequential();
            this.itemEmb.add(tf.layers.embedding({inputDim:numItems, outputDim:embDim, inputLength:1}));
            this.itemEmb.add(tf.layers.flatten());
        }
        this.optimizer = tf.train.adam(0.01);
    }

    userForward(uIdx){
        return this.userEmb.predict(tf.tensor2d(uIdx,[uIdx.length,1]));
    }

    itemForward(iIdx){
        return this.itemEmb.predict(tf.tensor2d(iIdx,[iIdx.length,1]));
    }

    async trainStep(batch){
        const uIdx = batch.map(d=>d.userId);
        const iPos = batch.map(d=>d.itemId);
        const iNeg = iPos.map(_=>Math.floor(Math.random()*this.numItems));
        const lossVal = await this.optimizer.minimize(()=>{
            const uE = this.userForward(uIdx);
            const iPE = this.itemForward(iPos);
            const iNE = this.itemForward(iNeg);
            const posScore = tf.sum(tf.mul(uE,iPE),1);
            const negScore = tf.sum(tf.mul(uE,iNE),1);
            const loss = tf.mean(tf.neg(tf.log(tf.sigmoid(posScore.sub(negScore)))));
            return loss;
        }, true);
        return lossVal.dataSync()[0];
    }

    async getTopK(uIdx,k){
        const uE = this.userForward([uIdx]);
        const batchSize = 512;
        let scores = [];
        for(let i=0;i<this.numItems;i+=batchSize){
            const batch = [...Array(Math.min(batchSize,this.numItems-i)).keys()].map(j=>i+j);
            const iE = this.itemForward(batch);
            const s = tf.matMul(uE,iE,true,false).dataSync();
            scores.push(...s);
        }
        return scores.map((v,i)=>({i,v})).sort((a,b)=>b.v-a.v).slice(0,k).map(d=>d.i);
    }

    async itemEmbeddingsForIndices(iIdx){
        return this.itemForward(iIdx);
    }
}
