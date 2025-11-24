// script.js
// DOM wiring and UI behaviour for MindMood

document.addEventListener("DOMContentLoaded", () => {
  initMindMoodState(); // from app.js

  initModeToggle();
  initAudioSelector();
  initSliders();
  initButtons();
  renderSessionLog();
});

// ---------- Mode toggle ----------

let currentMode = "text";

function initModeToggle() {
  const buttons = document.querySelectorAll(".mode-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      currentMode = btn.dataset.mode;
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      updateModePanels();
    });
  });
  updateModePanels();
}

function updateModePanels() {
  const textPanel = document.getElementById("text-input-panel");
  const audioPanel = document.getElementById("audio-input-panel");
  const sliderPanel = document.getElementById("slider-input-panel");

  textPanel.classList.toggle("hidden", currentMode !== "text");
  audioPanel.classList.toggle("hidden", currentMode !== "audio");
  sliderPanel.classList.toggle("hidden", currentMode !== "slider");
}

// ---------- Audio selector ----------

function initAudioSelector() {
  const select = document.getElementById("audio-select");
  const player = document.getElementById("audio-player");
  if (!select || !player) return;

  // Populate options
  DEMO_AUDIO.forEach(entry => {
    const opt = document.createElement("option");
    opt.value = entry.id;
    opt.textContent = entry.label;
    select.appendChild(opt);
  });

  if (DEMO_AUDIO.length) {
    select.value = DEMO_AUDIO[0].id;
    player.src = DEMO_AUDIO[0].file;
  }

  select.addEventListener("change", () => {
    const chosen = DEMO_AUDIO.find(a => a.id === select.value);
    if (chosen) {
      player.src = chosen.file;
      player.play().catch(() => {
        // autoplay may be blocked; ignore
      });
    }
  });
}

// ---------- Sliders ----------

function initSliders() {
  const sliders = [
    { id: "slider-euphoria", valueId: "val-euphoria" },
    { id: "slider-joy", valueId: "val-joy" },
    { id: "slider-sadness", valueId: "val-sadness" },
    { id: "slider-surprise", valueId: "val-surprise" }
  ];

  sliders.forEach(cfg => {
    const slider = document.getElementById(cfg.id);
    const valueLabel = document.getElementById(cfg.valueId);
    if (!slider || !valueLabel) return;
    valueLabel.textContent = slider.value;

    slider.addEventListener("input", () => {
      valueLabel.textContent = slider.value;
    });
  });
}

function readSliderValues() {
  const eup = document.getElementById("slider-euphoria");
  const joy = document.getElementById("slider-joy");
  const sad = document.getElementById("slider-sadness");
  const sup = document.getElementById("slider-surprise");

  return {
    euphoria: Number(eup.value) || 0,
    joy: Number(joy.value) || 0,
    sadness: Number(sad.value) || 0,
    surprise: Number(sup.value) || 0
  };
}

// ---------- Buttons ----------

function initButtons() {
  const btnRecommend = document.getElementById("btn-recommend");
  const btnClearHistory = document.getElementById("btn-clear-history");

  if (btnRecommend) {
    btnRecommend.addEventListener("click", onRecommendClick);
  }

  if (btnClearHistory) {
    btnClearHistory.addEventListener("click", () => {
      MindMoodState.sessionLog = [];
      localStorage.removeItem("mindmood_sessions");
      renderSessionLog();
    });
  }
}

function setStatus(text) {
  const el = document.getElementById("status-message");
  if (!el) return;
  el.textContent = text || "";
}

// ---------- Main recommend handler ----------

function onRecommendClick() {
  setStatus("");

  let profile;
  if (currentMode === "text") {
    const text = document.getElementById("mood-text").value.trim();
    if (!text) {
      setStatus("Please describe your mood in a few words.");
      return;
    }
    profile = textToEmotionProfile(text);
  } else if (currentMode === "audio") {
    const select = document.getElementById("audio-select");
    profile = audioChoiceToEmotionProfile(select.value);
  } else {
    const values = readSliderValues();
    const total = values.euphoria + values.joy + values.sadness + values.surprise;
    if (total === 0) {
      setStatus("Move at least one slider to describe how you feel.");
      return;
    }
    profile = slidersToEmotionProfile(values);
  }

  renderEmotionProfile(profile);

  const feedback = MindMoodState.userFeedback || {};
  const recs = getHybridRecommendations(profile, feedback, 6, 0.7);
  renderRecommendations(recs);

  // Log session
  const entry = createSessionEntry(profile, recs);
  MindMoodState.sessionLog.push(entry);
  if (MindMoodState.sessionLog.length > 20) {
    MindMoodState.sessionLog.shift();
  }
  saveSessionLog(MindMoodState.sessionLog);
  renderSessionLog();

  setStatus("Recommendations generated. You can mark them as helpful or not.");
}

// ---------- Rendering: emotion profile ----------

function renderEmotionProfile(profile) {
  const container = document.getElementById("emotion-profile-display");
  if (!container) return;

  const rows = EMOTIONS.map(e => {
    const v = profile[e] || 0;
    const percent = Math.round(v * 100);
    const label = e.charAt(0).toUpperCase() + e.slice(1);
    return `
      <div class="mm-profile-row">
        <div class="mm-profile-label">${label}</div>
        <div class="mm-profile-track">
          <div class="mm-profile-fill" style="width: ${percent}%;"></div>
        </div>
        <div class="mm-profile-value">${percent}%</div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="mm-profile-header">
      <p class="mm-label">Estimated emotion profile</p>
      <p class="mm-hint">
        This profile summarises how your current state maps onto four core emotions.
      </p>
    </div>
    <div class="mm-profile-bars">
      ${rows}
    </div>
  `;
}

// ---------- Rendering: recommendations ----------

function renderRecommendations(recs) {
  const container = document.getElementById("recommendation-list");
  const countEl = document.getElementById("rec-count");
  if (!container) return;

  if (!recs || recs.length === 0) {
    container.innerHTML = `<p class="mm-placeholder">No items matched your profile yet.</p>`;
    if (countEl) countEl.textContent = "";
    return;
  }

  container.innerHTML = "";
  recs.forEach(rec => {
    const item = rec.item;
    const tagsHtml = (item.tags || [])
      .map(t => `<span class="rec-tag">${t}</span>`)
      .join("");

    const card = document.createElement("div");
    card.className = "rec-card";
    card.innerHTML = `
      <div>
        <h3>${item.title}</h3>
        <div class="rec-type">${item.type}</div>
      </div>
      <p class="rec-desc">${item.description}</p>
      <div class="rec-tags">${tagsHtml}</div>
      <div class="rec-footer">
        <div class="rec-meta">
          CBF: ${rec.cbfScore.toFixed(2)} · Hybrid: ${rec.finalScore.toFixed(2)}
        </div>
        <div class="rec-feedback">
          <button class="rec-btn positive" data-id="${item.id}" data-val="1">Helpful</button>
          <button class="rec-btn negative" data-id="${item.id}" data-val="-1">Not helpful</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  if (countEl) {
    countEl.textContent = `${recs.length} items`;
  }

  // Attach handlers
  container.querySelectorAll(".rec-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const val = Number(btn.getAttribute("data-val"));
      handleFeedback(id, val);
    });
  });
}

// ---------- Feedback handling ----------

function handleFeedback(itemId, value) {
  if (!itemId) return;

  const feedback = MindMoodState.userFeedback || {};
  feedback[itemId] = value;
  MindMoodState.userFeedback = feedback;
  saveUserFeedback(feedback);

  renderSessionLog();
  setStatus("Feedback saved. Future suggestions will adapt to your choices.");
}

// ---------- Session log rendering ----------

function renderSessionLog() {
  const container = document.getElementById("session-log");
  if (!container) return;

  const log = MindMoodState.sessionLog || [];
  if (!log.length) {
    container.innerHTML = `<p class="mm-placeholder">
      No local history yet. Your next few sessions will appear here.
    </p>`;
    return;
  }

  container.innerHTML = log
    .slice()
    .reverse()
    .map(entry => {
      const date = new Date(entry.time);
      const timeStr = date.toLocaleString();
      const label = entry.dominantEmotion
        ? entry.dominantEmotion.charAt(0).toUpperCase() +
          entry.dominantEmotion.slice(1)
        : "Unknown";
      const count = entry.recommendedIds ? entry.recommendedIds.length : 0;
      return `
        <div class="session-row">
          <span>${timeStr}</span>
          <span>Dominant: <strong>${label}</strong> · ${count} items</span>
        </div>
      `;
    })
    .join("");
}
