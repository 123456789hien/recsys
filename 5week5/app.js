// app.js
class PageRankApp {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.pagerankScores = {};
        this.graphRenderer = window.graphRenderer;

        this.loadDefaultData();

        document.getElementById("computeBtn").addEventListener("click", () => this.computePageRank());
        document.getElementById("resetBtn").addEventListener("click", () => this.resetGraph());
    }

    async loadDefaultData() {
        try {
            const data = await d3.csv("data/karate.csv");
            const nodeSet = new Set();
            data.forEach(d => {
                nodeSet.add(Number(d.source));
                nodeSet.add(Number(d.target));
            });

            this.nodes = Array.from(nodeSet).map(id => ({ id }));
            this.edges = data.map(d => ({ source: Number(d.source), target: Number(d.target) }));

            this.graphRenderer.renderGraph(this.nodes, this.edges);
            this.populateTable();
        } catch (err) {
            console.error("Error loading data:", err);
        }
    }

    async computePageRank() {
        try {
            this.pagerankScores = await computePageRank(this.nodes, this.edges);
            this.graphRenderer.updateNodeSizes(this.pagerankScores);
            this.populateTable();
        } catch (err) {
            console.error("Error computing PageRank:", err);
        }
    }

    resetGraph() {
        this.loadDefaultData();
        document.getElementById("nodeDetails").innerHTML = `<p>Click on a node in the graph or table to see details</p>`;
    }

    getFriends(nodeId) {
        return this.edges
            .filter(e => e.source === nodeId || e.target === nodeId)
            .map(e => e.source === nodeId ? e.target : e.source);
    }

    getTopRecommendations(nodeId) {
        const friends = new Set(this.getFriends(nodeId));
        friends.add(nodeId);

        const candidates = this.nodes
            .filter(n => !friends.has(n.id))
            .map(n => ({ id: n.id, score: this.pagerankScores[n.id] || 0 }));

        candidates.sort((a, b) => b.score - a.score);
        return candidates.slice(0, 3);
    }

    populateTable() {
        const tbody = document.getElementById("tableBody");
        tbody.innerHTML = "";

        const tableData = this.nodes.map(n => ({
            id: n.id,
            pagerank: (this.pagerankScores[n.id] || 0).toFixed(4),
            friends: this.getFriends(n.id)
        })).sort((a, b) => b.pagerank - a.pagerank);

        tableData.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.id}</td>
                <td>${row.pagerank}</td>
                <td>${row.friends.join(", ")}</td>
            `;
            tr.addEventListener("click", () => this.showNodeDetails(row.id));
            tbody.appendChild(tr);
        });
    }

    showNodeDetails(nodeId) {
        const friends = this.getFriends(nodeId);
        const recommendations = this.getTopRecommendations(nodeId);
        const details = document.getElementById("nodeDetails");

        details.innerHTML = `
            <h4>Node: ${nodeId}</h4>
            <p><strong>Current Friends:</strong> ${friends.join(", ") || "None"}</p>
            <div class="recommendations">
                <h4>Top 3 Recommended Friends:</h4>
                ${recommendations.map(r => `<div class="recommendation-item">Node ${r.id} (Score: ${r.score.toFixed(4)})</div>`).join("")}
            </div>
        `;

        this.graphRenderer.highlightNode(nodeId);
        this.highlightTableRow(nodeId);
    }

    highlightTableRow(nodeId) {
        document.querySelectorAll("#nodeTable tbody tr").forEach(tr => tr.classList.remove("selected"));
        document.querySelectorAll("#nodeTable tbody tr").forEach(tr => {
            if (Number(tr.cells[0].textContent) === nodeId) tr.classList.add("selected");
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.app = new PageRankApp();
});
