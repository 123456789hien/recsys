// graph.js
// Handles D3.js graph rendering and interaction

let svg, linkGroup, nodeGroup, simulation;
let currentSelection = null;

export function renderGraph(containerId, nodes, edges, onNodeClick) {
  d3.select(`#${containerId}`).selectAll("*").remove();
  const width = document.getElementById(containerId).clientWidth;
  const height = document.getElementById(containerId).clientHeight;

  svg = d3.select(`#${containerId}`)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  linkGroup = svg.append("g").attr("stroke", "#999").attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(edges)
    .enter().append("line")
    .attr("stroke-width", 1.5);

  nodeGroup = svg.append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .enter().append("circle")
    .attr("r", d => 5 + d.score * 50)
    .attr("fill", d => d3.interpolateBlues(d.score))
    .call(drag(simulation))
    .on("click", (event, d) => {
      if (onNodeClick) onNodeClick(d);
    })
    .append("title")
    .text(d => `Node ${d.id}\nPageRank: ${d.score.toFixed(4)}`);

  simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id).distance(80))
    .force("charge", d3.forceManyBody().strength(-150))
    .force("center", d3.forceCenter(width / 2, height / 2));

  simulation.on("tick", () => {
    linkGroup
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    svg.selectAll("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);
  });
}

export function updateNodeStyles(nodes) {
  svg.selectAll("circle")
    .data(nodes)
    .attr("r", d => 5 + d.score * 50)
    .attr("fill", d => d3.interpolateBlues(d.score))
    .select("title")
    .text(d => `Node ${d.id}\nPageRank: ${d.score.toFixed(4)}`);
}

export function highlightNode(nodeId) {
  svg.selectAll("circle")
    .attr("stroke", d => d.id === nodeId ? "red" : "#fff")
    .attr("stroke-width", d => d.id === nodeId ? 3 : 1.5);
}

function drag(simulation) {
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
  return d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}
