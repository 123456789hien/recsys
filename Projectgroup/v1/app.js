// app.js
// Core logic for MindMood: emotion modeling and hybrid recommender

// Namespace for shared state
window.MindMoodState = window.MindMoodState || {};

// ---------- Emotion modeling ----------

// Simple keyword lexicon for text based emotion estimation
const MOOD_KEYWORDS = {
  sadness: [
    "sad",
    "down",
    "lonely",
    "tired",
    "drained",
    "upset",
    "low",
    "depressed",
    "hopeless",
    "anxious"
  ],
  joy: [
    "happy",
    "grateful",
    "content",
    "calm",
    "peaceful",
    "relaxed",
    "hopeful",
    "ok",
    "fine"
  ],
  euphoria: [
    "excited",
    "super happy",
    "ecstatic",
    "thrilled",
    "pumped",
    "energized",
    "amazing"
  ],
  surprise: [
    "shocked",
    "surprised",
    "unexpected",
    "wow",
    "suddenly",
    "did not expect"
  ]
};

function normalizeEmotion(scores) {
  const sum = Object.values(scores).reduce((a, b) => a + b, 0);
  if (sum === 0) return scores;
  const out = {};
  for (const k in scores) {
    out[k] = scores[k] / sum;
  }
  return out;
}

function textToEmotionProfile(text) {
  const lower = (text || "").toLowerCase();
  const scores = { euphoria: 0, joy: 0, sadness: 0, surprise: 0 };

  for (const emotion in MOOD_KEYWORDS) {
    const words = MOOD_KEYWORDS[emotion];
    words.forEach(word => {
      if (lower.includes(word)) {
        scores[emotion] += 1;
      }
    });
  }

  // Fallback when nothing matches
  if (Object.values(scores).every(v => v === 0)) {
    scores.joy = 0.5;
    scores.sadness = 0.5;
  }

  return normalizeEmotion(scores);
}

function slidersToEmotionProfile(values) {
  const scores = {
    euphoria: values.euphoria || 0,
    joy: values.joy || 0,
    sadness: values.sadness || 0,
    surprise: values.surprise || 0
  };
  return normalizeEmotion(scores);
}

function audioChoiceToEmotionProfile(audioId) {
  const entry = DEMO_AUDIO.find(a => a.id === audioId);
  if (!entry) {
    return normalizeEmotion({ euphoria: 0.1, joy: 0.7, sadness: 0.1, surprise: 0.1 });
  }
  const base = { euphoria: 0, joy: 0, sadness: 0, surprise: 0 };
  base[entry.emotion] = 1;
  return base;
}

// ---------- Vector helpers ----------

function itemToVector(item) {
  return [
    item.emotion_fit.euphoria || 0,
    item.emotion_fit.joy || 0,
    item.emotion_fit.sadness || 0,
    item.emotion_fit.surprise || 0
  ];
}

function profileToVector(profile) {
  return [
    profile.euphoria || 0,
    profile.joy || 0,
    profile.sadness || 0,
    profile.surprise || 0
  ];
}

function cosineSim(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---------- Content based filter ----------

function getCBFRecommendations(profile, topK) {
  const pVec = profileToVector(profile);
  const scored = CONTENT_ITEMS.map(item => {
    const iVec = itemToVector(item);
    return {
      item,
      cbfScore: cosineSim(pVec, iVec)
    };
  });

  scored.sort((a, b) => b.cbfScore - a.cbfScore);
  return scored.slice(0, topK);
}

// ---------- Collaborative filter (local feedback only) ----------

function loadUserFeedback() {
  try {
    const raw = localStorage.getItem("mindmood_feedback");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveUserFeedback(feedback) {
  try {
    localStorage.setItem("mindmood_feedback", JSON.stringify(feedback));
  } catch (e) {
    // ignore
  }
}

// Score based on similarity to liked items and distance from disliked ones
function getCFScore(item, feedback) {
  const liked = CONTENT_ITEMS.filter(i => feedback[i.id] === 1);
  const disliked = CONTENT_ITEMS.filter(i => feedback[i.id] === -1);

  if (liked.length === 0 && disliked.length === 0) return 0;

  const itemVector = itemToVector(item);
  let pos = 0;
  let neg = 0;

  liked.forEach(li => {
    pos += cosineSim(itemVector, itemToVector(li));
  });
  disliked.forEach(di => {
    neg += cosineSim(itemVector, itemToVector(di));
  });

  return pos - neg;
}

function squashCF(cf) {
  // logistic squashing into 0..1
  return 1 / (1 + Math.exp(-cf));
}

// ---------- Hybrid recommender ----------

function getHybridRecommendations(profile, feedback, topK, alpha) {
  const k = topK || 8;
  const w = typeof alpha === "number" ? alpha : 0.7;

  const cbf = getCBFRecommendations(profile, CONTENT_ITEMS.length);
  const scored = cbf.map(entry => {
    const cfScoreRaw = getCFScore(entry.item, feedback);
    const cfScore = squashCF(cfScoreRaw);
    const finalScore = w * entry.cbfScore + (1 - w) * cfScore;
    return {
      item: entry.item,
      cbfScore: entry.cbfScore,
      cfScore,
      finalScore
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored.slice(0, k);
}

// ---------- Session history ----------

function loadSessionLog() {
  try {
    const raw = localStorage.getItem("mindmood_sessions");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveSessionLog(log) {
  try {
    localStorage.setItem("mindmood_sessions", JSON.stringify(log));
  } catch (e) {
    // ignore
  }
}

function createSessionEntry(profile, recommendations) {
  const entries = Object.entries(profile).sort((a, b) => b[1] - a[1]);
  const dominant = entries.length ? entries[0][0] : "unknown";
  return {
    time: new Date().toISOString(),
    dominantEmotion: dominant,
    recommendedIds: recommendations.map(r => r.item.id)
  };
}

// ---------- State initialisation ----------

function initMindMoodState() {
  if (!MindMoodState.userFeedback) {
    MindMoodState.userFeedback = loadUserFeedback();
  }
  if (!MindMoodState.sessionLog) {
    MindMoodState.sessionLog = loadSessionLog();
  }
}
