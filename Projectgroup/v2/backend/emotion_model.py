# backend/emotion_model.py

import os
import numpy as np
import librosa

import torch
import torch.nn.functional as F

from transformers import AutoTokenizer, AutoModelForSequenceClassification
from tensorflow.keras.models import load_model


# ===== 1. Cấu hình cơ bản =====

# Thư mục gốc repo
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Đường dẫn model audio CNN
AUDIO_MODEL_PATH = os.path.join(BASE_DIR, "models", "cnn_emotion_best.h5")

# Cấu hình mel-spectrogram giống Colab
SR = 16000
N_MELS = 128
N_FRAMES = 128

# Nhãn cảm xúc cuối cùng của MindMood
OUR_CLASSES = ["Amused", "Angry", "Disgusted", "Neutral", "Sleepy"]


# ===== 2. Load model audio CNN =====

_audio_model = None


def load_audio_model():
    global _audio_model
    if _audio_model is None:
        _audio_model = load_model(AUDIO_MODEL_PATH)
    return _audio_model


# ===== 3. Hàm trích xuất log-mel spectrogram =====

def extract_log_mel(file_path, sr=SR, n_mels=N_MELS, n_frames=N_FRAMES):
    """
    Trích xuất log-mel spectrogram cố định kích thước (n_mels x n_frames)
    từ file .wav.
    """
    try:
        y, sr = librosa.load(file_path, sr=sr)

        # Chuẩn độ dài 3 giây
        max_len = sr * 3
        if len(y) > max_len:
            y = y[:max_len]
        else:
            pad_width = max_len - len(y)
            y = np.pad(y, (0, pad_width))

        S = librosa.feature.melspectrogram(
            y=y,
            sr=sr,
            n_mels=n_mels,
            n_fft=1024,
            hop_length=512
        )
        S_db = librosa.power_to_db(S, ref=np.max)

        # Chuẩn số frame
        if S_db.shape[1] < n_frames:
            pad_width = n_frames - S_db.shape[1]
            S_db = np.pad(S_db, ((0, 0), (0, pad_width)), mode="constant")
        elif S_db.shape[1] > n_frames:
            S_db = S_db[:, :n_frames]

        return S_db.astype(np.float32)
    except Exception as e:
        print(f"[extract_log_mel] Error processing {file_path}: {e}")
        return None


# ===== 4. Dự đoán cảm xúc từ audio với CNN =====

def predict_audio_emotion_cnn(file_path):
    """
    Trả về vector xác suất shape (5,) theo OUR_CLASSES
    hoặc None nếu lỗi.
    """
    model = load_audio_model()
    mel = extract_log_mel(file_path)
    if mel is None:
        return None

    mel = mel[np.newaxis, ..., np.newaxis]  # (1, 128, 128, 1)
    probs = model.predict(mel)[0]           # (5,)

    # đảm bảo tổng = 1
    probs = probs / (np.sum(probs) + 1e-8)
    return probs


# ===== 5. Load text emotion model (HuggingFace) =====

TEXT_MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"

_tokenizer = None
_text_model = None
_text_labels = None


def load_text_model():
    global _tokenizer, _text_model, _text_labels
    if _tokenizer is None or _text_model is None:
        _tokenizer = AutoTokenizer.from_pretrained(TEXT_MODEL_NAME)
        _text_model = AutoModelForSequenceClassification.from_pretrained(TEXT_MODEL_NAME)
        _text_model.eval()
        _text_labels = _text_model.config.id2label
    return _tokenizer, _text_model, _text_labels


# ===== 6. Map xác suất từ model text sang OUR_CLASSES =====

def text_probs_to_our_space(text_probs_dict):
    """
    text_probs_dict: dict label -> prob từ HF model
    trả về: np.array shape (5,) theo OUR_CLASSES
    """
    vec = np.zeros(len(OUR_CLASSES), dtype=np.float32)

    def add(src_label, our_label):
        if src_label in text_probs_dict:
            idx = OUR_CLASSES.index(our_label)
            vec[idx] += text_probs_dict[src_label]

    # map sơ bộ
    add("anger", "Angry")
    add("disgust", "Disgusted")
    add("joy", "Amused")
    add("neutral", "Neutral")
    add("sadness", "Sleepy")
    add("fear", "Sleepy")

    s = vec.sum()
    if s == 0:
        # nếu không map được gì thì coi là Neutral
        idx = OUR_CLASSES.index("Neutral")
        vec[idx] = 1.0
    else:
        vec = vec / s

    return vec


def predict_text_emotion(user_text):
    """
    Trả về:
      our_vec: np.array shape (5,) theo OUR_CLASSES
      raw_label_probs: dict label HF (lower) -> prob
    """
    tokenizer, text_model, text_labels = load_text_model()
    inputs = tokenizer(user_text, return_tensors="pt", truncation=True)

    with torch.no_grad():
        outputs = text_model(**inputs)
        logits = outputs.logits[0]
        probs = F.softmax(logits, dim=-1).cpu().numpy()

    label_probs = {
        text_labels[i].lower(): float(probs[i])
        for i in range(len(probs))
    }

    our_vec = text_probs_to_our_space(label_probs)
    return our_vec, label_probs


# ===== 7. Hybrid emotion: audio + text =====

def hybrid_emotion(audio_path=None, user_text=None, alpha_audio=0.7):
    """
    Kết hợp audio + text:
      - Nếu chỉ có audio -> dùng audio
      - Nếu chỉ có text -> dùng text
      - Nếu có cả hai -> final = alpha * audio + (1-alpha) * text

    Trả về:
      emotion_label: str (một trong OUR_CLASSES)
      final_probs: np.array shape (5,)
      source: "audio_only" | "text_only" | "hybrid"
      debug_info: dict chứa audio_probs, text_probs, raw_text_probs
    """
    assert audio_path is not None or user_text is not None, "Cần ít nhất audio hoặc text"

    audio_probs = None
    text_probs = None
    raw_text_probs = None

    if audio_path is not None:
        audio_probs = predict_audio_emotion_cnn(audio_path)

    if user_text is not None:
        text_probs, raw_text_probs = predict_text_emotion(user_text)

    if audio_probs is not None and text_probs is None:
        final_probs = audio_probs
        source = "audio_only"
    elif audio_probs is None and text_probs is not None:
        final_probs = text_probs
        source = "text_only"
    elif audio_probs is not None and text_probs is not None:
        final_probs = alpha_audio * audio_probs + (1.0 - alpha_audio) * text_probs
        source = "hybrid"
    else:
        # không có gì hợp lệ
        raise ValueError("Không có nguồn cảm xúc hợp lệ")

    idx = int(np.argmax(final_probs))
    emotion_label = OUR_CLASSES[idx]

    debug_info = {
        "audio_probs": audio_probs.tolist() if audio_probs is not None else None,
        "text_probs": text_probs.tolist() if text_probs is not None else None,
        "raw_text_probs": raw_text_probs
    }

    return emotion_label, final_probs.tolist(), source, debug_info
