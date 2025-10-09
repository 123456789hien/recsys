const RecSysApp = (function(){
    let users=[], items=[], interactions=[], itemEmbeddings={};
    let edaChart=null;

    // ---------------- Data Load ----------------
    async function autoLoad(){
        try {
            users = await loadCSV('https://raw.githubusercontent.com/<username>/<repo>/main/h_midexam/data/processed/users_clean.csv');
            items = await loadCSV('https://raw.githubusercontent.com/<username>/<repo>/main/h_midexam/data/processed/items_clean.csv');
            interactions = await loadCSV('https://raw.githubusercontent.com/<username>/<repo>/main/h_midexam/data/processed/interactions_clean.csv');
            itemEmbeddings = await loadJSON('https://raw.githubusercontent.com/<username>/<repo>/main/h_midexam/data/processed/item_embeddings.json');
            document.getElementById("status-note").innerText="✅ Auto-load success!";
            populateLocations();
            populateUsers();
            populateItems();
        } catch(err){
            console.error(err);
            document.getElementById("status-note").innerText="❌ Auto-load failed. Please upload CSV/JSON manually.";
            document.getElementById("upload-section").style.display='block';
        }
    }

    async function loadCSV(url){
        const resp = await fetch(url);
        const text = await resp.text();
        return parseCSVText(text);
    }

    async function loadJSON(url){
        const resp = await fetch(url);
        return await resp.json();
    }

    function parseCSVText(text){
        const lines = text.trim().split(/\r?\n/);
        const headers = lines[0].split(";").map(h=>h.trim());
        return lines.slice(1).map(line=>{
            const vals = line.split(";").map(v=>v.trim());
            let obj={};
            headers.forEach((h,i)=>obj[h]=vals[i]);
            return obj;
        });
    }

    // ---------------- Upload Files ----------------
    function setupUpload(){
        document.getElementById("uploadUsers").addEventListener("change", e=>readFile(e.target.files[0], data=>{
            users=data; document.getElementById("noteUsers").innerText="Users CSV loaded ✅"; populateLocations(); populateUsers();
        }));
        document.getElementById("uploadItems").addEventListener("change", e=>readFile(e.target.files[0], data=>{
            items=data; document.getElementById("noteItems").innerText="Items CSV loaded ✅"; populateItems();
        }));
        document.getElementById("uploadInteractions").addEventListener("change", e=>readFile(e.target.files[0], data=>{
            interactions=data; document.getElementById("noteInteractions").innerText="Interactions CSV loaded ✅";
        }));
        document.getElementById("uploadEmbeddings").addEventListener("change", e=>{
            const reader = new FileReader();
            reader.onload = evt=>{ itemEmbeddings = JSON.parse(evt.target.result); document.getElementById("noteEmbeddings").innerText="Embeddings loaded ✅"; };
            reader.readAsText(e.target.files[0]);
        });
    }

    function readFile(file, callback){
        const reader = new FileReader();
        reader.onload = evt=>{ callback(parseCSVText(evt.target.result)); };
        reader.readAsText(file);
    }

    // ---------------- Populate Dropdowns ----------------
    function populateLocations(){
        const locDiv = document.getElementById("location-buttons");
        locDiv.innerHTML="";
        const locs=[...new Set(users.map(u=>u.location))];
        locs.forEach(l=>{
            const btn=document.createElement("button");
            btn.className="location-btn"; btn.innerText=l;
            btn.onclick=()=>filterUsersByLocation(l);
            locDiv.appendChild(btn);
        });
    }

    function populateUsers(filtered=null){
        const sel = document.getElementById("user-select");
        sel.innerHTML='<option value="">-- Select User --</option>';
        (filtered||users).forEach(u=>{
            const opt = document.createElement("option"); opt.value=u.user_id; opt.innerText=u.user_id;
            sel.appendChild(opt);
        });
    }

    function populateItems(){
        const sel = document.getElementById("item-select");
        sel.innerHTML='<option value="">-- Select Item --</option>';
        items.forEach(it=>{
            const opt = document.createElement("option"); opt.value=it.item_id; opt.innerText=it.name;
            sel.appendChild(opt);
        });
    }

    function filterUsersByLocation(loc){
        const filtered = users.filter(u=>u.location===loc);
        populateUsers(filtered);
        document.getElementById("location-note").innerText=`✅ Filtered users by ${loc}`;
    }

    // ---------------- User Purchase History ----------------
    function updateHistory(item_id){
        const tbody = document.querySelector("#history-table tbody");
        tbody.innerHTML="";
        if(!item_id) return;
        const related = interactions.filter(i=>i.item_id===item_id);
        related.forEach(r=>{
            const it = items.find(itm=>itm.item_id===r.item_id);
            const tr = document.createElement("tr");
            tr.innerHTML=`<td>${r.user_id}</td><td>${r.rating}</td><td>${it?it.price:'-'}</td><td>${r.timestamp}</td>`;
            tbody.appendChild(tr);
        });
    }

    // ---------------- Top-10 Recommendations ----------------
    function computeTopN(){
        const topNTable = document.querySelector("#recommendation-table tbody");
        topNTable.innerHTML="";
        if(items.length===0) return;
        // compute average rating per item
        const ratingsMap = {};
        interactions.forEach(i=>{
            const key=i.item_id;
            ratingsMap[key] = ratingsMap[key]||{sum:0,count:0};
            ratingsMap[key].sum+=parseFloat(i.rating); ratingsMap[key].count+=1;
        });
        const topItems = items.map(it=>{
            const avgRating = ratingsMap[it.item_id]? ratingsMap[it.item_id].sum/ratingsMap[it.item_id].count : 0;
            const score = avgRating / (it.price?parseFloat(it.price):1);
            return {...it, avgRating, score};
        }).sort((a,b)=>b.score-a.score).slice(0,10);
        topItems.forEach((it,idx)=>{
            const tr = document.createElement("tr");
            tr.innerHTML=`<td>${idx+1}</td><td>${it.item_id}</td><td>${it.name}</td><td>${it.avgRating.toFixed(2)}</td><td>$${parseFloat(it.price).toFixed(2)}</td><td>${it.score.toFixed(2)}</td>`;
            topNTable.appendChild(tr);
        });
    }

    // ---------------- EDA ----------------
    function updateEDA(){
        if(!edaChart){
            const ctx = document.getElementById("eda-chart").getContext('2d');
            const ratings = interactions.map(i=>parseFloat(i.rating));
            const prices = interactions.map(i=>{
                const it = items.find(itm=>itm.item_id===i.item_id);
                return it?parseFloat(it.price):0;
            });
            edaChart = new Chart(ctx,{
                type:'scatter',
                data:{datasets:[{label:'Rating vs Price',data:ratings.map((r,i)=>({x:prices[i],y:r})),backgroundColor:'#e60073'}]},
                options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:'Price ($)'}},y:{title:{display:true,text:'Rating'}}}}
            });
        }
        // optional connection
        const meanRating = interactions.reduce((acc,i)=>acc+parseFloat(i.rating),0)/interactions.length;
        const meanPrice = items.reduce((acc,it)=>acc+parseFloat(it.price),0)/items.length;
        document.getElementById("eda-connection").innerText=`Mean Rating: ${meanRating.toFixed(2)}, Mean Price: $${meanPrice.toFixed(2)}`;
    }

    // ---------------- Init ----------------
    function init(){
        document.getElementById("btn-auto-load").onclick=autoLoad;
        document.getElementById("btn-upload").onclick=()=>{ document.getElementById("upload-section").style.display='block'; };
        setupUpload();

        document.getElementById("user-select").onchange=e=>{
            updateHistory(document.getElementById("item-select").value);
            computeTopN();
            updateEDA();
        };
        document.getElementById("item-select").onchange=e=>{
            updateHistory(e.target.value);
        };
    }

    return {init};
})();

window.onload=()=>RecSysApp.init();
