// data.js
// Static catalog for MindMood demo

// Emotions used in the project
const EMOTIONS = ["euphoria", "joy", "sadness", "surprise"];

const EMOTION_INDEX = {
  euphoria: 0,
  joy: 1,
  sadness: 2,
  surprise: 3
};

// Demo audio samples
// Put your actual files at assets/audio/<file>.wav or .mp3
const DEMO_AUDIO = [
  {
    id: "sample_sad",
    file: "assets/audio/sample_sad.wav",
    label: "Sad spoken diary entry",
    emotion: "sadness"
  },
  {
    id: "sample_joy",
    file: "assets/audio/sample_joy.wav",
    label: "Joyful message to a friend",
    emotion: "joy"
  },
  {
    id: "sample_euphoria",
    file: "assets/audio/sample_euphoria.wav",
    label: "Very excited announcement",
    emotion: "euphoria"
  },
  {
    id: "sample_surprise",
    file: "assets/audio/sample_surprise.wav",
    label: "Surprised reaction clip",
    emotion: "surprise"
  }
];

// Content items for recommendation
// emotion_fit values are hand-designed demo embeddings
const CONTENT_ITEMS = [
  {
    id: "meditation_5min",
    title: "5-minute breathing reset",
    type: "Meditation",
    description: "Short guided breathing that slows you down and releases tension.",
    tags: ["calm", "anxiety", "reset"],
    emotion_fit: { sadness: 0.9, joy: 0.3, euphoria: 0.1, surprise: 0.1 }
  },
  {
    id: "body_scan",
    title: "Gentle body scan",
    type: "Meditation",
    description: "Scan from head to toe, notice tension, and let your body soften.",
    tags: ["relax", "sleep", "grounding"],
    emotion_fit: { sadness: 0.7, joy: 0.4, euphoria: 0.1, surprise: 0.1 }
  },
  {
    id: "lofi_focus",
    title: "Lo-fi focus playlist",
    type: "Music",
    description: "Soft beats that support deep work or study without distraction.",
    tags: ["focus", "study", "calm"],
    emotion_fit: { sadness: 0.6, joy: 0.6, euphoria: 0.4, surprise: 0.1 }
  },
  {
    id: "gratitude_journal",
    title: "Gratitude journaling prompts",
    type: "Journaling",
    description: "Three simple questions to shift attention toward what still feels good.",
    tags: ["gratitude", "reflection", "optimism"],
    emotion_fit: { sadness: 0.5, joy: 0.9, euphoria: 0.4, surprise: 0.2 }
  },
  {
    id: "walk_outside",
    title: "10-minute mindful walk",
    type: "Activity",
    description: "Go outside, notice sounds and light, and let your breathing match your steps.",
    tags: ["movement", "stress", "energy"],
    emotion_fit: { sadness: 0.4, joy: 0.7, euphoria: 0.5, surprise: 0.3 }
  },
  {
    id: "power_boost",
    title: "Energy boost music mix",
    type: "Music",
    description: "Upbeat but not aggressive tracks to lift energy without overwhelm.",
    tags: ["energy", "motivation", "euphoria"],
    emotion_fit: { sadness: 0.2, joy: 0.7, euphoria: 0.9, surprise: 0.4 }
  },
  {
    id: "calm_surprise",
    title: "For sudden changes",
    type: "Micro-practice",
    description: "Box breathing technique to steady yourself after unexpected events.",
    tags: ["surprise", "shock", "steady"],
    emotion_fit: { sadness: 0.3, joy: 0.3, euphoria: 0.1, surprise: 0.9 }
  },
  {
    id: "evening_reflection",
    title: "End-of-day reflection",
    type: "Journaling",
    description: "Close the day with three lines of reflection, one line of intention for tomorrow.",
    tags: ["sleep", "closure", "routine"],
    emotion_fit: { sadness: 0.6, joy: 0.6, euphoria: 0.2, surprise: 0.1 }
  },
  {
    id: "soothing_ambient",
    title: "Soothing ambient soundscape",
    type: "Music",
    description: "Soft ambient textures that fade into the background and support relaxation.",
    tags: ["relax", "stress", "background"],
    emotion_fit: { sadness: 0.8, joy: 0.4, euphoria: 0.1, surprise: 0.1 }
  },
  {
    id: "micro_stretch",
    title: "3-minute desk stretch",
    type: "Activity",
    description: "Simple stretches for neck, shoulders, and back when you feel stuck.",
    tags: ["tension", "movement", "office"],
    emotion_fit: { sadness: 0.4, joy: 0.6, euphoria: 0.4, surprise: 0.2 }
  }
];
