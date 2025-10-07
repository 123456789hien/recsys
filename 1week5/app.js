// app.js
import { computePageRank } from './pagerank.js';
import { renderGraph, updateNodeStyles, highlightNode } from './graph.js';

class PageRankApp {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.sortedAsc = true;

    document.getElementById('loadDataBtn').addEventListener('click', () => this.loadDefaultData());
    document.getElementById('computeBtn').addEventListener('click', () => this.computePageRank());

    // Sortable table
    document.querySelectorAll('#nodeTable thead th[data-sort]').forEach(th =>
      th.addEventListener('click', () => this.sortTable(th.dataset.sort))
    );
  }

  async loadDefaultData() {
    try {
      const response = await fetch('./data/karate.csv');
      const csvText = await response.text();
      const rows = d3.csvParse(csvText);

      const nodeSet = new Set();
      this.edges = rows.map(r => {
        nodeSet.add(r.source);
        nodeSet.add(r.target);
        return { source: r.source, target: r.target };
      });
      this.nodes = Array.from(nodeSet).map(id => ({ id, score: 0 }));

      renderGraph('graph', this.nodes, this.edges, d => this.onNodeClick(d));
      this.updateTable();
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }

  async computePageRank() {
    try {
      const scores = await computePageRank(this.nodes, this.edges);
      this.nodes.forEach((n, i) => n.score = scores[i]);

      updateNodeStyles(this.nodes);
      this.updateTable();
    } catch (err) {
      console.error('Error computing PageRank:', err);
    }
  }

  updateTable() {
    const tbody = document.querySelector('#nodeTable tbody');
    tbody.innerHTML = '';

    this.nodes.forEach(node => {
      const friends = this.edges
        .filter(e => e.source === node.id || e.target === node.id)
        .map(e => e.source === node.id ? e.target : e.source);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${node.id}</td>
        <td>${node.score.toFixed(4)}</td>
        <td>${friends.join(', ')}</td>
      `;
      tr.addEventListener('click', () => this.onNodeClick(node));
      tbody.appendChild(tr);
    });
  }

  sortTable(field) {
    this.sortedAsc = !this.sortedAsc;
    if (field === 'id') {
      this.nodes.sort((a, b) => this.sortedAsc ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id));
    } else if (field === 'score') {
      this.nodes.sort((a, b) => this.sortedAsc ? a.score - b.score : b.score - a.score);
    }
    this.updateTable();
  }

  onNodeClick(node) {
    highlightNode(node.id);

    const friends = this.edges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => e.source === node.id ? e.target : e.source);

    const notFriends = this.nodes
      .filter(n => n.id !== node.id && !friends.includes(n.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    document.getElementById('friendsList').textContent = `Friends: ${friends.join(', ') || 'None'}`;
    document.getElementById('recommendations').textContent =
      `Recommended New Friends: ${notFriends.map(n => `${n.id} (${n.score.toFixed(4)})`).join(', ') || 'None'}`;

    document.querySelectorAll('#nodeTable tbody tr').forEach(tr => tr.classList.remove('selected'));
    [...document.querySelectorAll('#nodeTable tbody tr')].forEach(tr => {
      if (tr.children[0].textContent === node.id) tr.classList.add('selected');
    });
  }
}

window.addEventListener('DOMContentLoaded', () => new PageRankApp());
