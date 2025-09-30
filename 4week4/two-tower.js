// two-tower.js
class TwoTowerModel {
    constructor(numUsers,numItems,embDim,useDeep=false){
        this.numUsers=numUsers;
        this.numItems=numItems;
        this.embDim=embDim;
        this.useDeep=useDeep;

        if(useDeep){
            // User tower with embedding + MLP
            this.userEmb = tf.sequential();
            this.userEmb.add(tf.layers.embedding({inputDim:numUsers, outputDim:embDim, inputLength:1}));
            this.userEmb.add(tf.layers.flatten());
            this.userEmb.add(tf.layers.dense({units:embDim*2, activation:'relu'}));
            this.userEmb.add(tf.layers.dense({units:embDim}));

            // Item tower with embedding + MLP
            this.itemEmb = tf.sequential();
            this.itemEmb.add(tf.layers.embedding({inputDim:numItems, outputDim:embDim, inputLength:1}));
            this.itemEmb.add(tf.layers.flatten());
            this.itemEmb.add(tf.layers.dense({units:embDim*2, activation:'relu'}));
            this.itemEmb.add(tf.layers.dense({units:embDim}));
        }else{
            // Simple embedding only
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

    score(uEmb,iEmb){
        return tf.matMul(uEmb,iEmb,true,false);
    }

    async trainStep(batch){
        const uIdx = batch.map(d=>d.userId);
        const iIdx = batch.map(d=>d.itemId);
        const lossVal = await this.optimizer.minimize(()=>{
            const uE = this.userForward(uIdx);
            const iE = this.itemForward(iIdx);
            const logits = this.score(uE,iE);
            const labels = tf.eye(batch.length);
            const loss = tf.losses.softmaxCrossEntropy(labels,logits,true).mean();
            return loss;
        },true);
        return lossVal.dataSync()[0];
    }

    async getTopK(uIdx,k){
        const uE = this.userForward([uIdx]);
        const allItems = [...Array(this.numItems).keys()];
        const batchSize = 512;
        let scores=[];
        for(let i=0;i<this.numItems;i+=batchSize){
            const batch = allItems.slice(i,i+batchSize);
            const iE = this.itemForward(batch);
            const s = this.score(uE,iE).dataSync();
            scores.push(...s);
        }
        const topK = scores.map((v,i)=>({i,v})).sort((a,b)=>b.v-a.v).slice(0,k).map(d=>d.i);
        return topK;
    }

    async itemEmbeddingsForIndices(iIdx){
        return this.itemForward(iIdx);
    }
}
