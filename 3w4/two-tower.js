// two-tower.js
// Implements Two-Tower model with in-batch contrastive loss
class TwoTowerModel {
    constructor(numUsers,numItems,embDim){
        this.numUsers=numUsers; this.numItems=numItems; this.embDim=embDim;
        this.userEmbedding=tf.variable(tf.randomNormal([numUsers,embDim],0,0.05));
        this.itemEmbedding=tf.variable(tf.randomNormal([numItems,embDim],0,0.05));
        this.optimizer=tf.train.adam(0.01);
    }

    userForward(userIdx){ return tf.gather(this.userEmbedding,userIdx); }
    itemForward(itemIdx){ return tf.gather(this.itemEmbedding,itemIdx); }
    score(uEmb,iEmb){ return tf.sum(tf.mul(uEmb,iEmb),1); }

    async trainStep(userIdx,posItemIdx){
        const self=this;
        return await tf.tidy(()=>{
            const lossVal = self.optimizer.minimize(()=>{
                const uEmb=self.userForward(userIdx);
                const iEmb=self.itemForward(posItemIdx);
                // in-batch negatives via dot-product
                const logits = tf.matMul(uEmb,iEmb.transpose());
                const labels=tf.tensor1d([...Array(userIdx.length).keys()],'int32');
                const loss = tf.losses.softmaxCrossEntropy(labels,logits,true);
                return loss;
            },true);
            return lossVal;
        });
    }

    getUserEmbedding(userIdx){ return this.userForward(userIdx); }

    getScoresForAllItems(uEmb){
        const batchSize = 256;
        let allScores = [];
        for(let i=0;i<this.numItems;i+=batchSize){
            const slice = this.itemEmbedding.slice([i,0],[Math.min(batchSize,this.numItems-i),this.embDim]);
            const scoreSlice = tf.matMul(uEmb,slice.transpose());
            allScores.push(scoreSlice);
        }
        return tf.concat(allScores,1).squeeze();
    }
}
