// app.js
class PageRankApp {
    constructor() {
        this.graph = { nodes: [], edges: [], adjacencyList: {} };
        this.pageRankScores = null;
        this.selectedNode = null;
        this.isComputing = false;

        this.initializeEventListeners();
        this.loadDefaultData();
    }

    initializeEventListeners() {
        document.getElementById('computeBtn').addEventListener('click', () => this.computePageRank());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGraph());
    }

    async loadDefaultData() {
        try {
            const res = await fetch('data/karate.csv');
            const csvText = await res.text();
            this.graph = this.parseCSVToGraph(csvText);
            if (window.graphRenderer) window.graphRenderer.renderGraph(this.graph);
            this.updateTable();
        } catch (err) {
            console.error('Error loading data:', err);
            alert('Error loading graph data.');
        }
    }

    parseCSVToGraph(csvText) {
        const edges = [];
        const nodesSet = new Set();
        csvText.trim().split('\n').forEach(line => {
            const [s,t] = line.split(',').map(Number);
            edges.push({ source: s, target: t });
            nodesSet.add(s); nodesSet.add(t);
        });
        const nodes = Array.from(nodesSet).sort((a,b)=>a-b).map(id=>({id}));
        const adjacencyList = {};
        nodes.forEach(n => adjacencyList[n.id]=[]);
        edges.forEach(e => {
            adjacencyList[e.source].push(e.target);
            adjacencyList[e.target].push(e.source);
        });
        return { nodes, edges, adjacencyList };
    }

    async computePageRank() {
        if (this.isComputing) return;
        this.isComputing = true;
        document.getElementById('computeBtn').disabled = true;
        document.getElementById('computeBtn').textContent = 'Computing...';

        try {
            this.pageRankScores = await computePageRank(this.graph.nodes, this.graph.edges, 50, 0.85);
            this.updateTable();
            if (window.graphRenderer) window.graphRenderer.updatePageRankScores(this.pageRankScores);
        } catch (err) {
            console.error('Error computing PageRank:', err);
            alert('Error computing PageRank.');
        } finally {
            this.isComputing = false;
            document.getElementById('computeBtn').disabled = false;
            document.getElementById('computeBtn').textContent = 'Compute PageRank';
        }
    }

    updateTable() {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        const nodesSorted = [...this.graph.nodes].sort((a,b)=>{
            const pa = this.pageRankScores?a=this.pageRankScores[a.id]:0;
            const pb = this.pageRankScores?b=this.pageRankScores[b.id]:0;
            return pb - pa;
        });
        nodesSorted.forEach(node => {
            const row = document.createElement('tr');
            row.dataset.nodeId = node.id;
            const friends = this.graph.adjacencyList[node.id] || [];
            const pr = this.pageRankScores ? this.pageRankScores[node.id].toFixed(4) : 'N/A';
            row.innerHTML = `<td>${node.id}</td><td>${pr}</td><td>${friends.join(', ')}</td>`;
            row.addEventListener('click', ()=>this.selectNode(node.id));
            if (this.selectedNode===node.id) row.classList.add('selected');
            tbody.appendChild(row);
        });
    }

    selectNode(nodeId) {
        this.selectedNode = nodeId;
        document.querySelectorAll('#tableBody tr').forEach(r => r.classList.toggle('selected', Number(r.dataset.nodeId)===nodeId));
        if (window.graphRenderer) window.graphRenderer.highlightNode(nodeId);
        this.showNodeDetails(nodeId);
    }

    showNodeDetails(nodeId) {
        const div = document.getElementById('nodeDetails');
        const friends = this.graph.adjacencyList[nodeId]||[];
        let recHtml = '';
        if(this.pageRankScores){
            const recs = this.graph.nodes.filter(n=>!friends.includes(n.id)&&n.id!==nodeId)
                .map(n=>({id:n.id,score:this.pageRankScores[n.id]}))
                .sort((a,b)=>b.score-a.score)
                .slice(0,3);
            recHtml = recs.length>0?`<div class="recommendations"><h4>Recommended New Friends (Top 3 by PageRank):</h4>${recs.map(r=>`<div class="recommendation-item">Node ${r.id} (PageRank: ${r.score.toFixed(4)}) <button onclick="app.connectNodes(${nodeId},${r.id})">Connect</button></div>`).join('')}</div>`:'<p>No recommendations.</p>';
        }else recHtml='<p>Compute PageRank to see recommendations.</p>';
        div.innerHTML=`<div class="node-info"><h4>Node ${nodeId}</h4><p><strong>Current Friends:</strong> ${friends.length>0?friends.join(', '):'None'}</p>${recHtml}</div>`;
    }

    connectNodes(s,t){
        if(!this.graph.adjacencyList[s].includes(t)) this.graph.adjacencyList[s].push(t);
        if(!this.graph.adjacencyList[t].includes(s)) this.graph.adjacencyList[t].push(s);
        this.graph.edges.push({source:s,target:t});
        this.computePageRank();
    }

    resetGraph(){
        this.pageRankScores=null;
        this.selectedNode=null;
        this.loadDefaultData();
        document.getElementById('nodeDetails').innerHTML='<p>Click on a node in the graph or table to see details</p>';
    }
}

let app;
document.addEventListener('DOMContentLoaded', ()=>{ app=new PageRankApp(); window.app=app; });
