// graph.js
class GraphRenderer {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.selectedNode = null;
        this.width = 0;
        this.height = 0;

        this.initSVG();
    }

    initSVG() {
        const container = document.getElementById(this.containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        this.svg = d3.select(`#${this.containerId}`).append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        this.svg.append("g");

        const zoom = d3.zoom().scaleExtent([0.1, 4])
            .on("zoom", (event) => this.svg.select("g").attr("transform", event.transform));

        this.svg.call(zoom);
    }

    renderGraph(nodes, edges, pagerankScores = {}) {
        this.nodes = nodes.map(n => ({ ...n, pagerank: pagerankScores[n.id] || 0.1 }));
        this.links = edges;

        this.updateGraph();
    }

    updateGraph() {
        const g = this.svg.select("g");
        g.selectAll("*").remove();

        this.simulation = d3.forceSimulation(this.nodes)
            .force("link", d3.forceLink(this.links).id(d => d.id).distance(50))
            .force("charge", d3.forceManyBody().strength(-100))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .force("collision", d3.forceCollide().radius(20));

        const link = g.append("g")
            .selectAll("line")
            .data(this.links)
            .enter().append("line")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 1);

        const node = g.append("g")
            .selectAll("circle")
            .data(this.nodes)
            .enter().append("circle")
            .attr("r", d => this.getRadius(d.pagerank))
            .attr("fill", d => this.getColor(d.pagerank))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .call(d3.drag()
                .on("start", (event, d) => this.dragStart(event, d))
                .on("drag", (event, d) => this.dragged(event, d))
                .on("end", (event, d) => this.dragEnd(event, d)))
            .on("click", (event, d) => {
                event.stopPropagation();
                if (window.app) window.app.showNodeDetails(d.id);
            });

        node.append("title").text(d => `Node ${d.id}\nPageRank: ${d.pagerank.toFixed(4)}`);

        const label = g.append("g")
            .selectAll("text")
            .data(this.nodes)
            .enter().append("text")
            .text(d => d.id)
            .attr("font-size", "10px")
            .attr("dx", 12)
            .attr("dy", 4)
            .attr("pointer-events", "none");

        this.simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            node.attr("cx", d => d.x).attr("cy", d => d.y);
            label.attr("x", d => d.x).attr("y", d => d.y);
        });
    }

    getRadius(pagerank) {
        return 8 + (pagerank * 120);
    }

    getColor(pagerank) {
        const intensity = Math.min(pagerank * 10, 1);
        const r = Math.floor(100 + intensity * 155);
        const g = Math.floor(100 + (1 - intensity) * 155);
        const b = Math.floor(200 - intensity * 100);
        return `rgb(${r}, ${g}, ${b})`;
    }

    highlightNode(nodeId) {
        this.svg.selectAll("circle").attr("stroke", "#fff").attr("stroke-width", 1.5);
        this.svg.selectAll("circle").filter(d => d.id === nodeId)
            .attr("stroke", "#ff6b6b").attr("stroke-width", 3);
    }

    updateNodeSizes(pagerankScores) {
        this.nodes.forEach(n => n.pagerank = pagerankScores[n.id]);
        this.updateGraph();
    }

    dragStart(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragEnd(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.graphRenderer = new GraphRenderer("graph");
});
