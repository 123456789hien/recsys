// graph.js
class GraphRenderer {
    constructor(selector, appInstance) {
        this.selector = selector;
        this.app = appInstance;
        this.svg = null;
        this.simulation = null;
        this.nodeElements = null;
        this.linkElements = null;
    }

    renderGraph(nodes, links) {
        d3.select(this.selector).selectAll("*").remove();

        this.svg = d3.select(this.selector)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "500");

        this.simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(this.svg.node().clientWidth / 2, 250));

        this.linkElements = this.svg.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("stroke-width", 1.5);

        this.nodeElements = this.svg.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(nodes)
            .enter().append("circle")
            .attr("r", 8)
            .attr("fill", "#2196f3")
            .on("click", (event, d) => this.app.showNodeDetails(d.id))
            .append("title")
            .text(d => d.id);

        this.simulation.on("tick", () => {
            this.linkElements
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            this.svg.selectAll("circle")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });
    }

    updateNodeSizes(scores) {
        const maxScore = Math.max(...Object.values(scores));
        this.svg.selectAll("circle")
            .attr("r", d => 5 + (scores[d.id] / maxScore) * 20)
            .attr("fill", d => d3.interpolateBlues(scores[d.id] / maxScore));
    }

    highlightNode(nodeId) {
        this.svg.selectAll("circle")
            .attr("stroke", d => (d.id === nodeId ? "red" : "#fff"))
            .attr("stroke-width", d => (d.id === nodeId ? 3 : 1.5));
    }
}
