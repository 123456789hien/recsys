# MindMood - Emotion-Aware Mental Wellness Recommender

## Introduction
MindMood is a hybrid emotion-aware recommender system designed to suggest content (exercises, music, videos, etc.) based on the user's emotional state. It combines audio and text inputs to recommend suitable wellness activities, such as calming exercises, music, or mindfulness tasks.

## Project Structure
MindMood/
├── README.md
├── models/
│ ├── cnn_emotion_best.h5
│ └── label_encoder.pkl
├── data/
│ └── content_items.csv
├── backend/
│ ├── init.py
│ ├── emotion_model.py
│ ├── recommender.py
│ ├── api.py
│ └── requirements.txt
└── frontend/
├── index.html
├── styles.css
└── app.js


## Requirements

### Backend:
- Python 3.x
- Libraries:
    - TensorFlow
    - scikit-learn
    - Flask or FastAPI (for API)
    - librosa
    - pyngrok (for ngrok integration in Colab)
    - transformers

### Frontend:
- HTML, CSS, JavaScript (for Streamlit or React-based UI)

## How to Run
1. Clone the repository to your local machine or cloud environment.
2. Install required libraries by running `pip install -r requirements.txt`.
3. Run the backend API using Flask or FastAPI (depending on the configuration in `api.py`).
4. Start the frontend server (`index.html` or Streamlit app).
5. Interact with the user interface by inputting emotions through text or voice.

---

## How to Train the Emotion Recognition Model

1. **Audio Preprocessing**: Extract log-mel spectrograms from the audio data (audio files) using `librosa`.
2. **Model**: Train a CNN-based model for emotion recognition on the processed audio files. Save the model as `cnn_emotion_best.h5`.

## How to Use the Recommender System

1. **Input**: User inputs mood and optional voice input.
2. **Feature Extraction**: Extract emotion profile from text and audio.
3. **Hybrid Recommender**: Use cosine similarity and collaborative filtering to recommend content.
4. **Feedback Loop**: Optionally improve the model by collecting feedback from the user.
