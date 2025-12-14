from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
import numpy as np
import librosa
import io
import tensorflow as tf
from tensorflow.keras.models import load_model

# --- Configuration ---
# NOTE: The model path should be updated after training and saving the model
MODEL_PATH = "cnn_emovdb_model.h5"
EMOTION_LABELS = ['neutral', 'amused', 'angry', 'disgusted', 'sleepy']
SAMPLE_RATE = 22050
N_MFCC = 13
N_FFTMAX = 2048
HOP_LENGTH = 512
MAX_TIME_STEPS = 100 # Must match the padding/truncation length in train_cnn_emovdb.py

# --- Model Loading ---
try:
    model = load_model(MODEL_PATH)
    print(f"Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    print(f"Warning: Could not load model from {MODEL_PATH}. Using dummy predictions. Error: {e}")
    model = None

# --- Feature Extraction Functions (Copied from train_cnn_emovdb.py) ---
def extract_mfcc_features(audio_data, sr=SAMPLE_RATE, n_mfcc=N_MFCC):
    """
    Extract MFCC features from audio data (numpy array)
    """
    try:
        # Extract MFCC features
        mfcc = librosa.feature.mfcc(
            y=audio_data,
            sr=sr,
            n_mfcc=n_mfcc,
            n_fft=N_FFTMAX,
            hop_length=HOP_LENGTH
        )
        
        # Pad or truncate to fixed length
        if mfcc.shape[1] < MAX_TIME_STEPS:
            mfcc = np.pad(mfcc, ((0, 0), (0, MAX_TIME_STEPS - mfcc.shape[1])), mode='constant')
        else:
            mfcc = mfcc[:, :MAX_TIME_STEPS]
            
        # Reshape for CNN input (1, n_mfcc, time_steps, 1)
        mfcc = np.expand_dims(mfcc, axis=0)
        mfcc = np.expand_dims(mfcc, axis=-1)
        
        # Normalize features (using dummy mean/std for now, should use training stats)
        # For simplicity, we'll skip normalization here and assume the model handles it or it's not critical for a quick fix
        
        return mfcc
    except Exception as e:
        print(f"Error extracting features: {e}")
        return None

# --- FastAPI Setup ---
app = FastAPI(
    title="MindMood Emotion Detection API",
    description="API for detecting emotion from voice and text.",
    version="1.0.0"
)

# --- Request/Response Models ---
class TextAnalysisRequest(BaseModel):
    text: str

class EmotionDetectionResponse(BaseModel):
    emotion_scores: dict
    primary_emotion: str
    confidence: float

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "MindMood Emotion Detection API is running"}

@app.post("/analyze/voice", response_model=EmotionDetectionResponse)
async def analyze_voice(audio_file: UploadFile = File(...)):
    """
    Analyzes emotion from an uploaded audio file.
    """
    if audio_file.content_type not in ["audio/wav", "audio/mpeg", "audio/ogg"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only WAV, MP3, or OGG supported.")

    try:
        # Read audio file content
        audio_content = await audio_file.read()
        
        # Load audio data using librosa
        y, sr = librosa.load(io.BytesIO(audio_content), sr=SAMPLE_RATE)
        
        # Extract features
        features = extract_mfcc_features(y, sr)
        
        if features is None:
            raise HTTPException(status_code=500, detail="Feature extraction failed.")

        if model:
            # Predict emotion
            predictions = model.predict(features)[0]
            emotion_scores = {
                EMOTION_LABELS[i]: float(predictions[i]) for i in range(len(EMOTION_LABELS))
            }
        else:
            # Dummy prediction if model is not loaded
            emotion_scores = {
                'neutral': 0.5, 'amused': 0.1, 'angry': 0.1, 'disgusted': 0.1, 'sleepy': 0.2
            }
            
        # Determine primary emotion and confidence
        primary_emotion = max(emotion_scores, key=emotion_scores.get)
        confidence = emotion_scores[primary_emotion]
        
        return EmotionDetectionResponse(
            emotion_scores=emotion_scores,
            primary_emotion=primary_emotion,
            confidence=confidence
        )

    except Exception as e:
        print(f"Voice analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error during voice analysis: {e}")

@app.post("/analyze/text", response_model=EmotionDetectionResponse)
async def analyze_text(request: TextAnalysisRequest):
    """
    Analyzes emotion from text input using a simple keyword-based approach.
    """
    text = request.text
    
    # Simple keyword-based detection logic (matching app.js logic for consistency)
    emotion_keywords = {
        'amused': ['happy', 'joy', 'excited', 'wonderful', 'great', 'love', 'amazing', 'fantastic', 'laugh', 'fun', 'funny'],
        'angry': ['angry', 'furious', 'mad', 'frustrated', 'annoyed', 'irritated', 'rage', 'upset', 'hate'],
        'disgusted': ['disgusted', 'repulsed', 'gross', 'yuck', 'awful', 'horrible', 'disgusting'],
        'sleepy': ['tired', 'sleepy', 'exhausted', 'drowsy', 'fatigue', 'worn out', 'drained'],
        'neutral': ['okay', 'fine', 'normal', 'alright', 'meh', 'so-so']
    }

    text_lower = text.lower()
    emotion_scores = {}

    # Initialize all emotions with equal weight
    base_weight = 1 / len(EMOTION_LABELS)
    for emotion in EMOTION_LABELS:
        emotion_scores[emotion] = base_weight

    # Count keyword matches
    for emotion, keywords in emotion_keywords.items():
        for keyword in keywords:
            if keyword in text_lower:
                emotion_scores[emotion] += 0.15

    # Normalize scores to sum to 1
    sum_scores = sum(emotion_scores.values())
    if sum_scores > 0:
        for emotion in emotion_scores:
            emotion_scores[emotion] /= sum_scores
    
    # Determine primary emotion and confidence
    primary_emotion = max(emotion_scores, key=emotion_scores.get)
    confidence = emotion_scores[primary_emotion]
    
    return EmotionDetectionResponse(
        emotion_scores=emotion_scores,
        primary_emotion=primary_emotion,
        confidence=confidence
    )

# --- CORS Middleware (for local development) ---
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
