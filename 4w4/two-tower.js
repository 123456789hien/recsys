// two-tower.js
class TwoTowerModel{
    constructor(numUsers,numItems,embDim,deep=false){
        this.numUsers=numUsers; this.numItems=numItems; this.embDim=embDim; this.deep=deep;
        this.userEmbedding=tf.variable(tf.randomNormal([numUsers,embDim],0,0.05));
        this.itemEmbedding=tf.variable(tf.randomNormal([numItems,embDim],0,0.05));
        if(deep){
            this.userDense1=tf.layers.dense({units:64,activation:'relu'});
            this.userDrop=tf.layers.dropout({rate:0.3});
            this.itemDense1=tf.layers.dense({units:64,activation:'relu'});
            this.itemDrop=tf.layers.dropout({rate:0.3});
        }
        this.optimizer=tf.train.adam(0.01);
    }

    userForward(idx){
        let emb=tf.gather(this.userEmbedding,idx);
        if(this.deep) emb=this.userDrop.apply(this.userDense1.apply(emb));
        return emb;
    }

    itemForward(idx){
        let emb=tf.gather(this.itemEmbedding,idx);
        if(this.deep) emb=this.itemDrop.apply(this.itemDense1.apply(emb));
        return emb;
    }

    score(uEmb,iEmb){ return tf.sum(tf.mul(uEmb,iEmb),1); }

    async trainStep(userIdx,posItemIdx){
        const self=this;
        return await tf.tidy(()=>{
            return self.optimizer.minimize(()=>{
                const uEmb=self.userForward(userIdx);
                const iEmb=self.itemForward(posItemIdx);
                const logits=tf.matMul(uEmb,iEmb.transpose());
                const labels=tf.tensor1d([...Array(userIdx.length).keys()],'int32');
                return tf.losses.softmaxCrossEntropy(labels,logits,true);
            },true);
        });
    }

    getUserEmbedding(idx){ return this.userForward(idx); }

    getScoresForAllItems(uEmb){
        const batchSize=256;
        let allScores=[];
        for(let i=0;i<this.numItems;i+=batchSize){
            const slice=this.itemEmbedding.slice([i,0],[Math.min(batchSize,this.numItems-i),this.embDim]);
            let iEmb=slice;
            if(this.deep){ iEmb=this.itemDrop.apply(this.itemDense1.apply(slice)); }
            const scoreSlice=tf.matMul(uEmb,iEmb.transpose());
            allScores.push(scoreSlice);
        }
        return tf.concat(allScores,1).squeeze();
    }
}
