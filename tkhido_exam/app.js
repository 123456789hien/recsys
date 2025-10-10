const DATA_URL = "https://raw.githubusercontent.com/123456789hien/recsys/refs/heads/main/tkhido_exam/fashion_recommender.csv";
let allData=[], currentCategory="All", selectedProduct=null;

// ------------------- Load CSV -------------------
async function loadData(){
    const res=await fetch(DATA_URL);
    const text=await res.text();
    const rows=text.trim().split("\n");
    const headers=rows[0].split(";");
    allData=rows.slice(1).map(r=>{
        const cols=r.split(";");
        let obj={};
        headers.forEach((h,i)=>{
            let val=cols[i];
            if(h==="Price" || h==="Rating/5") val=parseFloat(val.replace(",","."));
            obj[h]=val;
        });
        return obj;
    });
}

// ------------------- Category Filter -------------------
function getCategoryData(category){
    if(category==="All") return allData;
    return allData.filter(d=>d.Category===category);
}

// ------------------- Top Recommendations -------------------
function showTopRecommendations(){
    const container=document.getElementById("top-recommendations-container");
    container.innerHTML="";
    const data=getCategoryData(currentCategory);
    data.sort((a,b)=>(0.7*b["Rating/5"]+0.3*b.Price)-(0.7*a["Rating/5"]+0.3*a.Price));
    data.slice(0,5).forEach(d=>{
        const card=document.createElement("div");
        card.className="card";
        card.innerHTML=`<strong>${d["Product ID"]} - ${d["Product Name"]}</strong><br>${d.Brand}`;
        const tooltip=document.createElement("div");
        tooltip.className="card-tooltip";
        tooltip.innerHTML=`Rating: ${d["Rating/5"]}<br>Price: ${d.Price}<br>Color: ${d.Color}<br>Size: ${d.Size}`;
        card.appendChild(tooltip);
        const badge=document.createElement("div");
        badge.className="badge-hot";
        badge.innerText="🔥";
        card.appendChild(badge);
        container.appendChild(card);
    });
}

// ------------------- Product Select -------------------
function populateProductSelect(){
    const select=document.getElementById("product-select");
    select.innerHTML="";
    const data=getCategoryData(currentCategory);
    const names=[...new Set(data.map(d=>d["Product Name"]))];
    names.forEach(n=>{
        const opt=document.createElement("option");
        opt.value=n;
        opt.text=n;
        select.appendChild(opt);
    });
}

// ------------------- Content-Based Similar Products -------------------
function showSimilarProducts(){
    const container=document.getElementById("similar-products-container");
    container.innerHTML="";
    selectedProduct=document.getElementById("product-select").value;
    const data=getCategoryData(currentCategory).filter(d=>d["Product Name"]===selectedProduct);
    const features=data.map(d=>[d["Rating/5"],d.Price]);
    const norms=features.map(f=>{
        const norm=Math.sqrt(f[0]**2+f[1]**2);
        return [f[0]/norm,f[1]/norm];
    });
    const sims=data.map((d,i)=>{
        return data.map((d2,j)=>{
            if(i===j) return -1;
            const dot=norms[i][0]*norms[j][0]+norms[i][1]*norms[j][1];
            return dot;
        });
    });
    // flatten and sort
    const flat=[];
    data.forEach((d,i)=>{
        sims[i].forEach((s,j)=>{if(s>=0) flat.push({d:data[j],score:s});});
    });
    flat.sort((a,b)=>b.score-a.score);
    flat.slice(0,5).forEach(f=>{
        const card=document.createElement("div");
        card.className="card";
        card.innerHTML=`<strong>${f.d["Product ID"]} - ${f.d["Product Name"]}</strong><br>${f.d.Brand}`;
        const tooltip=document.createElement("div");
        tooltip.className="card-tooltip";
        tooltip.innerHTML=`Rating: ${f.d["Rating/5"]}<br>Price: ${f.d.Price}<br>Color: ${f.d.Color}<br>Size: ${f.d.Size}`;
        card.appendChild(tooltip);
        container.appendChild(card);
    });
}

// ------------------- Purchase History -------------------
function updatePurchaseHistory(){
    const tbody=document.querySelector("#purchase-history-table tbody");
    tbody.innerHTML="";
    if(!selectedProduct) return;
    const data=getCategoryData(currentCategory).filter(d=>d["Product Name"]===selectedProduct);
    data.forEach(d=>{
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${d["Product ID"]}</td><td>${d["User ID"]}</td><td>${d.Brand}</td><td>${d["Rating/5"]}</td><td>${d.Price}</td>`;
        tbody.appendChild(tr);
    });
}

// ------------------- EDA Charts -------------------
let ratingChart, priceChart, scatterChart;
function updateEDACharts(){
    const data=getCategoryData(currentCategory);
    const ctxR=document.getElementById("rating-chart").getContext("2d");
    const ctxP=document.getElementById("price-chart").getContext("2d");
    const ctxS=document.getElementById("price-rating-scatter").getContext("2d");
    const ratingVals=data.map(d=>d["Rating/5"]);
    const priceVals=data.map(d=>d.Price);

    if(ratingChart) ratingChart.destroy();
    ratingChart=new Chart(ctxR,{type:'bar',data:{labels:ratingVals.map((_,i)=>i+1),datasets:[{label:'Rating',data:ratingVals,backgroundColor:'#ff69b4'}]},options:{plugins:{tooltip:{callbacks:{label:ctx=>`Rating: ${ctx.raw}`}}},responsive:true,title:{display:true,text:'Rating Distribution'}}});

    if(priceChart) priceChart.destroy();
    priceChart=new Chart(ctxP,{type:'bar',data:{labels:priceVals.map((_,i)=>i+1),datasets:[{label:'Price',data:priceVals,backgroundColor:'#ffb6c1'}]},options:{plugins:{tooltip:{callbacks:{label:ctx=>`Price: ${ctx.raw}`}}},responsive:true,title:{display:true,text:'Price Distribution'}}});

    if(scatterChart) scatterChart.destroy();
    scatterChart=new Chart(ctxS,{type:'scatter',data:{datasets:[{label:'Price vs Rating',data:data.map(d=>({x:d.Price,y:d["Rating/5"],extra:d})),backgroundColor:'#ff1493'}]},options:{plugins:{tooltip:{callbacks:{label:ctx=>`Rating: ${ctx.raw.extra["Rating/5"]}, Price: ${ctx.raw.extra.Price}, Color: ${ctx.raw.extra.Color}, Size: ${ctx.raw.extra.Size}`}}},responsive:true,title:{display:true,text:'Price vs Rating Scatter'}}});
}

// ------------------- Top-10 Tables -------------------
function updateTop10Tables(){
    const data=getCategoryData(currentCategory).filter(d=>!selectedProduct || d["Product Name"]===selectedProduct);
    // Top 10 by Rating
    const tbodyR=document.querySelector("#top10-rating-table tbody");
    tbodyR.innerHTML="";
    data.sort((a,b)=>b["Rating/5"]-a["Rating/5"]).slice(0,10).forEach((d,i)=>{
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d["Rating/5"]}</td><td>${d.Color}</td><td>${d.Size}</td>`;
        tbodyR.appendChild(tr);
    });
    // Top 10 by Score
    const maxR=Math.max(...data.map(d=>d["Rating/5"]));
    const maxP=Math.max(...data.map(d=>d.Price));
    const tbodyS=document.querySelector("#top10-score-table tbody");
    tbodyS.innerHTML="";
    data.forEach(d=>d.score=0.5*(d["Rating/5"]/maxR)+0.3*(d.Price/maxP)+0.2*Math.random());
    data.sort((a,b)=>b.score-a.score).slice(0,10).forEach((d,i)=>{
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${i+1}</td><td>${d["Product ID"]}</td><td>${d["Product Name"]}</td><td>${d.Brand}</td><td>${d["Rating/5"]}</td><td>${d.Price}</td><td>${d.Color}</td><td>${d.Size}</td><td>${d.score.toFixed(2)}</td>`;
        tbodyS.appendChild(tr);
    });
}

// ------------------- Event Listeners -------------------
document.addEventListener("DOMContentLoaded", async()=>{
    await loadData();
    showTopRecommendations();
    populateProductSelect();
    updateEDACharts();
    updateTop10Tables();
    updatePurchaseHistory();

    document.querySelectorAll(".category-btn").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            currentCategory=btn.dataset.category;
            document.querySelectorAll(".category-btn").forEach(b=>b.classList.remove("active"));
            btn.classList.add("active");
            showTopRecommendations();
            populateProductSelect();
            updateEDACharts();
            updateTop10Tables();
            updatePurchaseHistory();
            document.getElementById("similar-products-container").innerHTML="";
        });
    });

    document.getElementById("show-similar-btn").addEventListener("click", ()=>{
        showSimilarProducts();
        updateTop10Tables();
        updatePurchaseHistory();
    });
});
