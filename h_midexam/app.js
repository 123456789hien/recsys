const RecSysApp = (() => {
    let users=[], items=[], interactions=[], itemEmbeddings={};
    let edaChart=null;

    // -----------------------------
    // DATA LOAD
    // -----------------------------
    async function loadCSV(url){ const resp=await fetch(url); return await resp.text(); }
    function parseUsersCSV(text){ return text.split(/\r?\n/).slice(1).filter(l=>l.trim()!=="").map(l=>{ const [user_id,location]=l.split(";"); return {user_id,location}; }); }
    function parseItemsCSV(text){ return text.split(/\r?\n/).slice(1).filter(l=>l.trim()!=="").map(l=>{ const [item_id,name,price]=l.split(";"); return {item_id,name,price:parseFloat(price)}; }); }
    function parseInteractionsCSV(text){ return text.split(/\r?\n/).slice(1).filter(l=>l.trim()!=="").map(l=>{ const [user_id,item_id,timestamp,event_type,rating]=l.split(";"); return {user_id,item_id,timestamp,event_type,rating:parseFloat(rating)}; }); }
    
    async function autoLoad(){
        try{
            users=parseUsersCSV(await loadCSV("data/processed/users_clean.csv"));
            items=parseItemsCSV(await loadCSV("data/processed/items_clean.csv"));
            interactions=parseInteractionsCSV(await loadCSV("data/processed/interactions_clean.csv"));
            const embResp=await fetch("data/processed/item_embeddings.json");
            itemEmbeddings=await embResp.json();
            document.getElementById("status-note").innerText="✅ Data loaded successfully from GitHub!";
            enableUploadButtons();
            populateAllDropdowns();
            renderEDA();
        }catch(e){console.error(e); document.getElementById("status-note").innerText="❌ Auto-load failed. Use Upload Data.";}
    }

    function enableUploadButtons(){ document.querySelectorAll(".upload-btn").forEach(b=>b.disabled=false); }
    function uploadCSV(fileInput,callback){ const file=fileInput.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=e=>callback(e.target.result); reader.readAsText(file);}
    function uploadJSON(fileInput,callback){ const file=fileInput.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=e=>callback(JSON.parse(e.target.result)); reader.readAsText(file); }

    // -----------------------------
    // POPULATE DROPDOWNS
    // -----------------------------
    function populateLocationButtons(){ const container=document.getElementById("location-buttons"); container.innerHTML=""; const locs=[...new Set(users.map(u=>u.location))].filter(l=>l&&l.trim()!==""); locs.forEach(l=>{ const btn=document.createElement("button"); btn.className="location-btn"; btn.innerText=l; btn.onclick=()=>filterUsersByLocation(l); container.appendChild(btn); }); document.getElementById("location-note").innerText="✅ Locations ready"; }
    function populateUserDropdown(filteredUsers=null){ const select=document.getElementById("user-select"); select.innerHTML='<option value="">-- Select User --</option>'; const list=filteredUsers||users; list.forEach(u=>{ const option=document.createElement("option"); option.value=u.user_id; option.innerText=u.user_id; select.appendChild(option); }); document.getElementById("user-note").innerText="✅ Users ready"; }
    function populateItemDropdown(){ const select=document.getElementById("item-select"); select.innerHTML='<option value="">-- Select Item --</option>'; items.forEach(it=>{ const option=document.createElement("option"); option.value=it.item_id; option.innerText=it.name; select.appendChild(option); }); }
    function populateContentItemDropdown(){ const select=document.getElementById("content-item-select"); select.innerHTML='<option value="">-- Select Item --</option>'; items.forEach(it=>{ const option=document.createElement("option"); option.value=it.item_id; option.innerText=it.name; select.appendChild(option); }); }
    function populateMFDropdowns(){ const uSelect=document.getElementById("mf-user-select"); const iSelect=document.getElementById("mf-item-select"); uSelect.innerHTML='<option value="">-- Select User --</option>'; users.forEach(u=>{ const o=document.createElement("option"); o.value=u.user_id;o.innerText=u.user_id; uSelect.appendChild(o); }); iSelect.innerHTML='<option value="">-- Select Item --</option>'; items.forEach(it=>{ const o=document.createElement("option"); o.value=it.item_id;o.innerText=it.name; iSelect.appendChild(o); }); }

    function populateAllDropdowns(){ populateLocationButtons(); populateUserDropdown(); populateItemDropdown(); populateContentItemDropdown(); populateMFDropdowns(); }

    function filterUsersByLocation(loc){ const filtered=loc==="All"?users:users.filter(u=>u.location===loc); populateUserDropdown(filtered); document.getElementById("user-note").innerText=`✅ Users filtered by location: ${loc}`; }

    // -----------------------------
    // PURCHASE HISTORY
    // -----------------------------
    function updatePurchaseHistoryOfItem(item_id){
        const hist=interactions.filter(i=>i.item_id===item_id);
        const tbody=document.querySelector("#history-table tbody"); tbody.innerHTML="";
        hist.forEach(h=>{
            const item=items.find(it=>it.item_id===h.item_id);
            const tr=document.createElement("tr");
            tr.innerHTML=`<td>${h.user_id}</td><td>${item.name}</td><td>${h.rating}</td><td>$${item.price.toFixed(2)}</td><td>${h.timestamp}</td>`;
            tbody.appendChild(tr);
        });
    }

    // -----------------------------
    // TOP-10 GLOBAL RECOMMENDATIONS
    // -----------------------------
    function computeTop10Global(){
        const aggScores={}; const ratingsMap={};
        items.forEach(it=>{
            const itemRatings=interactions.filter(i=>i.item_id===it.item_id).map(r=>r.rating);
            ratingsMap[it.item_id]=itemRatings.length>0?itemRatings.reduce((a,b)=>a+b,0)/itemRatings.length:0;
            const priceFactor=it.price>0?1/it.price:1;
            aggScores[it.item_id]=ratingsMap[it.item_id]*0.5+priceFactor*0.5;
        });
        const top10=items.map(it=>({id:it.item_id,name:it.name,rating:ratingsMap[it.item_id],price:it.price,score:aggScores[it.item_id]})).sort((a,b)=>b.score-a.score).slice(0,10);
        const tbody=document.querySelector("#recommendation-table tbody"); tbody.innerHTML="";
        top10.forEach((it,idx)=>{ const tr=document.createElement("tr"); tr.innerHTML=`<td>${idx+1}</td><td>${it.id}</td><td>${it.name}</td><td>${it.rating.toFixed(2)}</td><td>$${it.price.toFixed(2)}</td><td>${it.score.toFixed(2)}</td>`; tbody.appendChild(tr); });
    }

    // -----------------------------
    // CONTENT-BASED RECOMMENDER
    // -----------------------------
    function contentBasedRecommendation(item_id){
        if(!item_id)return;
        const baseVec=itemEmbeddings[item_id];
        if(!baseVec){ alert("Embeddings missing"); return; }
        const scores=items.map(it=>({id:it.item_id,name:it.name,score:cosineSim(baseVec,itemEmbeddings[it.item_id]||[]) })).filter(it=>it.id!==item_id).sort((a,b)=>b.score-a.score).slice(0,10);
        const tbody=document.querySelector("#content-table tbody"); tbody.innerHTML="";
        scores.forEach((it,idx)=>{ const tr=document.createElement("tr"); tr.innerHTML=`<td>${idx+1}</td><td>${it.id}</td><td>${it.name}</td><td>${it.score.toFixed(2)}</td>`; tbody.appendChild(tr); });
    }
    function cosineSim(a,b){ if(a.length!==b.length||a.length===0)return 0; const dot=a.map((v,i)=>v*b[i]).reduce((x,y)=>x+y,0); const normA=Math.sqrt(a.map(v=>v*v).reduce((x,y)=>x+y,0)); const normB=Math.sqrt(b.map(v=>v*v).reduce((x,y)=>x+y,0)); return dot/(normA*normB); }

    // -----------------------------
    // EDA
    // -----------------------------
    function renderEDA(){
        const ratings=items.map(it=>{ const itemRatings=interactions.filter(i=>i.item_id===it.item_id).map(r=>r.rating); return itemRatings.length>0?itemRatings.reduce((a,b)=>a+b,0)/itemRatings.length:0; });
        const prices=items.map(it=>it.price);
        const ctx=document.getElementById("eda-chart").getContext('2d');
        if(edaChart) edaChart.destroy();
        edaChart=new Chart(ctx,{ type:'scatter', data:{ datasets:[{ label:'Price vs Rating', data:ratings.map((r,i)=>({x:prices[i],y:r})), backgroundColor:'#e60073' }] }, options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ x:{title:{display:true,text:'Price ($)'}}, y:{title:{display:true,text:'Rating'}} } } });
        const corr=(correlation(ratings,prices)||0).toFixed(2);
        document.getElementById("eda-summary").innerText=`Mean Rating: ${mean(ratings).toFixed(2)}, Mean Price: ${mean(prices).toFixed(2)}, Rating-Price correlation: ${corr}`;
    }
    function mean(arr){ return arr.reduce((a,b)=>a+b,0)/arr.length; }
    function correlation(a,b){ const n=a.length; if(n!==b.length)return null; const meanA=mean(a); const meanB=mean(b); const cov=a.map((v,i)=> (v-meanA)*(b[i]-meanB)).reduce((x,y)=>x+y,0)/n; const stdA=Math.sqrt(a.map(v=>Math.pow(v-meanA,2)).reduce((x,y)=>x+y,0)/n); const stdB=Math.sqrt(b.map(v=>Math.pow(b-meanB,2)).reduce((x,y)=>x+y,0)/n); return cov/(stdA*stdB); }

    // -----------------------------
    // EVENT LISTENERS
    // -----------------------------
    function attachListeners(){
        document.getElementById("auto-load-btn").onclick=autoLoad;
        document.getElementById("upload-users").onchange=e=>uploadCSV(e.target,text=>{users=parseUsersCSV(text); document.getElementById("status-note").innerText="✅ Users uploaded"; populateAllDropdowns(); });
        document.getElementById("upload-items").onchange=e=>uploadCSV(e.target,text=>{items=parseItemsCSV(text); document.getElementById("status-note").innerText="✅ Items uploaded"; populateAllDropdowns(); });
        document.getElementById("upload-interactions").onchange=e=>uploadCSV(e.target,text=>{interactions=parseInteractionsCSV(text); document.getElementById("status-note").innerText="✅ Interactions uploaded"; });
        document.getElementById("upload-embeddings").onchange=e=>uploadJSON(e.target,json=>{itemEmbeddings=json; document.getElementById("status-note").innerText="✅ Embeddings uploaded"; populateContentItemDropdown(); });
        document.getElementById("item-select").onchange=e=>updatePurchaseHistoryOfItem(e.target.value);
        document.getElementById("compute-top10-btn").onclick=computeTop10Global;
        document.getElementById("content-recommend-btn").onclick=e=>contentBasedRecommendation(document.getElementById("content-item-select").value);
    }

    function init(){ attachListeners(); document.getElementById("status-note").innerText="🔄 Ready. Upload CSV or click Auto-Load."; }

    return {init};
})();
window.onload=()=>RecSysApp.init();
