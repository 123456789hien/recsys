let users=[], items=[], interactions=[], recommendations={};

async function loadData(){
    try{
        users = await loadCSV("data/processed/users_clean.csv");
        items = await loadCSV("data/processed/items_clean.csv");
        interactions = await loadCSV("data/processed/interactions_clean.csv");

        precomputeRecommendations();
        populateUserDropdown();
    } catch(err){
        console.error("Error loading data:", err);
        alert("Failed to load CSV files.");
    }
}

function loadCSV(url){
    return new Promise((resolve,reject)=>{
        Papa.parse(url,{
            download:true,
            header:true,
            dynamicTyping:true,
            skipEmptyLines:true,
            complete: results => resolve(results.data.filter(d=>d.user_id || d.item_id)),
            error: err => reject(err)
        });
    });
}

// Compute personalized top-N recommendations per user
function precomputeRecommendations(){
    const itemMap = {};
    items.forEach(it=>itemMap[it.item_id]=it);

    const itemCounts = {};
    interactions.forEach(i=>{
        itemCounts[i.item_id]=(itemCounts[i.item_id]||0)+1;
    });
    const topItems = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1]).map(t=>t[0]);

    users.forEach(u=>{
        const userItems = interactions.filter(i=>i.user_id==u.user_id).map(i=>i.item_id);
        const userSet = new Set(userItems);

        let scored = items.map(it=>{
            if(userSet.has(it.item_id)) return null;
            let score = 0;
            userItems.forEach(uid=>{
                const prev = itemMap[uid];
                if(!prev) return;
                const setA = new Set(prev.name.toLowerCase().split(" "));
                const setB = new Set(it.name.toLowerCase().split(" "));
                const inter = new Set([...setA].filter(x=>setB.has(x)));
                const union = new Set([...setA,...setB]);
                score += union.size>0 ? inter.size/union.size : 0;
            });
            // Adjust score by popularity
            score += (itemCounts[it.item_id]||0)/1000; 
            return {...it, score:score.toFixed(2)};
        }).filter(x=>x!=null);

        scored.sort((a,b)=>b.score-a.score);

        recommendations[u.user_id] = scored.length>0 ? scored : topItems.map(id=>{
            const it = itemMap[id];
            return {item_id:id, name: it?it.name:id, price: it?it.price:0, score:0};
        });
    });
}

function populateUserDropdown(){
    const select = document.getElementById("userSelect");
    select.innerHTML="";
    users.forEach(u=>{
        const opt = document.createElement("option");
        opt.value = u.user_id;
        opt.textContent = `User ${u.user_id} (${u.location || "Unknown"})`;
        select.appendChild(opt);
    });
    select.addEventListener("change", updateUserDisplay);
    updateUserDisplay();
}
