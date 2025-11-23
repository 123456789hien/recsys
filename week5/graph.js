// graph.js
class GraphRenderer {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.width = 0;
        this.height = 0;
        this.selectedNode = null;
        this.initializeSVG();
    }

    initializeSVG() {
        const container = document.getElementById(this.containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        this.svg = d3.select(`#${this.containerId}`)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g');

        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.svg.attr('transform', event.transform);
            });
        d3.select(`#${this.containerId} svg`).call(zoom);
    }

    renderGraph(graph, pageRankScores = null) {
        this.nodes = graph.nodes.map(node => ({
            ...node,
            pageRank: pageRankScores ? pageRankScores[node.id] : 0.1
        }));
        this.links = graph.edges.map(edge => ({ source: edge.source, target: edge.target }));
        this.updateGraph();
    }

    updateGraph() {
        const g = this.svg;
        g.selectAll('*').remove();

        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(d => d.id).distance(50))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(20));

        const link = g.append('g')
            .selectAll('line')
            .data(this.links)
            .enter()
            .append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);

        const node = g.append('g')
            .selectAll('circle')
            .data(this.nodes)
            .enter()
            .append('circle')
            .attr('r', d => 8 + d.pageRank * 12)
            .attr('fill', d => `rgb(${Math.min(d.pageRank*10,1)*255},100,200)`)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .call(d3.drag()
                .on('start', (event, d) => { if (!event.active) this.simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on('end', (event, d) => { if (!event.active) this.simulation.alphaTarget(0); d.fx = null; d.fy = null; })
            )
            .on('click', (event, d) => {
                event.stopPropagation();
                this.highlightNode(d.id);
                if (window.app) window.app.selectNode(d.id);
            });

        g.append('g')
            .selectAll('text')
            .data(this.nodes)
            .enter()
            .append('text')
            .text(d => d.id)
            .attr('font-size', '10px')
            .attr('dx', 12)
            .attr('dy', 4)
            .attr('pointer-events', 'none');

        node.append('title').text(d => `Node ${d.id}\nPageRank: ${d.pageRank.toFixed(4)}`);

        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            g.selectAll('text')
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });
    }

    highlightNode(nodeId) {
        this.svg.selectAll('circle').attr('stroke', '#fff').attr('stroke-width', 1.5);
        this.svg.selectAll('circle').filter(d => d.id === nodeId).attr('stroke', '#ff6b6b').attr('stroke-width', 3);
        this.selectedNode = nodeId;
    }

    updatePageRankScores(scores) {
        this.nodes.forEach(node => { node.pageRank = scores[node.id]; });
        this.updateGraph();
    }
}

let graphRenderer;
document.addEventListener('DOMContentLoaded', () => {
    graphRenderer = new GraphRenderer('graph');
    window.graphRenderer = graphRenderer;
});
