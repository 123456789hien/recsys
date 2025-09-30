<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Two-Tower Deep Retrieval (MovieLens 100K) — TF.js</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root{
      --bg: #fff5f8;
      --panel: #ffffff;
      --accent: #ff8fb1;
      --accent-2: #ff5fa8;
      --muted: #7a6b6b;
      --shadow: rgba(0,0,0,0.06);
      --radius: 12px;
      font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    }
    html,body{height:100%; margin:0; background: linear-gradient(180deg,#fff 0%,var(--bg) 100%); color:#2b2b2b}
    .wrap{max-width:1200px; margin:28px auto; padding:22px; background:var(--panel); border-radius:var(--radius); box-shadow:0 6px 30px var(--shadow); text-align:center}
    h1{margin:4px 0 6px; color:#b2265a}
    p.lead{margin:0 0 14px; color:var(--muted)}
    .controls{display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin:12px 0}
    button{background:linear-gradient(180deg,var(--accent) 0%, var(--accent-2) 100%); color:white; border:none; padding:10px 14px; border-radius:10px; cursor:pointer; box-shadow: 0 3px 10px rgba(255,95,168,0.18); font-weight:600}
    button.secondary{background:#fff; color:var(--accent-2); border:1px solid #ffd7e6;}
    button:disabled{opacity:0.5; cursor:not-allowed}
    label.switch{display:flex; gap:8px; align-items:center; font-size:14px; color:var(--muted)}
    #status{margin-top:8px; font-size:14px}
    .grid-top{display:grid; grid-template-columns: 1fr 1fr; gap:18px; align-items:start; margin-top:16px}
    .panel{background:#fff; padding:14px; border-radius:10px; border:1px solid #fff0f4; text-align:left}
    canvas{background:transparent; border-radius:8px}
    #lossCanvas{width:100%; height:200px; border:1px dashed rgba(255,95,168,0.08)}
    #compCanvas{width:100%; height:150px; border:1px dashed rgba(255,95,168,0.08); margin-top:8px}
    #projCanvas{width:100%; height:420px; border:1px dashed rgba(255,95,168,0.06)}
    #results{margin-top:16px; text-align:left}
    .results-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 12px;
    }
    .results-table table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .results-table th, .results-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #ffe6ef;
      text-align: left;
    }
    .results-table th {
      background: #fff0f7;
      color: #b2265a;
      font-weight: 600;
    }
    .results-table td {
      color: #444;
    }
    .results-table caption {
      caption-side: top;
      margin-bottom: 6px;
      font-weight: 600;
      color: #b03b6e;
      text-align: left;
    }
    .center-note{margin-top:10px; font-size:13px; color:var(--muted)}
    .tips{margin-top:12px; font-size:13px; color:#8a6b74; text-align:left}
    @media(max-width:1000px){ .grid-top{grid-template-columns:1fr} .results-grid{grid-template-columns:1fr} }
  </style>
</head>
<body>
  <div class="wrap" role="main" aria-label="Two-Tower TF.js Demo">
    <h1>Two-Tower Retrieval — MovieLens 100K</h1>
    <p class="lead">Client-side demo (GitHub Pages). Theme: pink & white — cute, centered and professional.</p>

    <div class="controls" aria-hidden="false">
      <button id="btnLoad">Load Data</button>
      <button id="btnTrain" disabled>Train (Baseline → Deep)</button>
      <button id="btnTest" disabled>Test</button>
      <button id="btnStop" class="secondary" disabled>Stop Training</button>
      <label class="switch"><input type="checkbox" id="useBPR" /> Use BPR loss (alt)</label>
    </div>

    <div id="status">Status: <strong id="statustext">idle</strong></div>

    <!-- Hàng trên: Training + Embedding Projection -->
    <div class="grid-top">
      <div class="panel">
        <h3 style="color:#b03b6e">Training Monitor</h3>
        <canvas id="lossCanvas" width="500" height="200"></canvas>
        <canvas id="compCanvas" width="500" height="150"></canvas>
      </div>
      <div class="panel">
        <h3 style="color:#b03b6e">Embedding Projection (Deep model)</h3>
        <canvas id="projCanvas" width="500" height="420"></canvas>
        <div class="center-note">Hover points to see movie titles</div>
      </div>
    </div>

    <!-- Hàng dưới: Results -->
    <div class="panel" style="margin-top:20px">
      <h3 style="color:#b03b6e">Results</h3>
      <div id="results">
        <div style="color:var(--muted)">After training, press <strong>Test</strong> to compare results.</div>
        <div class="results-grid">
          <div class="results-table" id="ratedTable"></div>
          <div class="results-table" id="deepTable"></div>
          <div class="results-table" id="baseTable"></div>
        </div>
      </div>
    </div>

    <div class="tips">
      <strong>Notes:</strong>
      <ul>
        <li>Place <code>/data/u.data</code> and <code>/data/u.item</code> in the repo root under <code>/data/</code>.</li>
        <li>Baseline = embedding lookup only. Deep = embedding + Dense layers (ReLU + Dropout).</li>
      </ul>
    </div>

    <div style="margin-top:14px; text-align:center">
      <small style="color:var(--muted)">Built with TensorFlow.js — No server, runs entirely in browser.</small>
    </div>
  </div>

  <div id="tooltip" class="tooltip"></div>

  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.18.0/dist/tf.min.js"></script>
  <script src="two-tower.js"></script>
  <script src="app.js"></script>
</body>
</html>
