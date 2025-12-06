import gdown
import os
import pickle
import librosa
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model

# Tải mô hình và encoder từ Google Drive
def download_from_drive(file_id, output_path):
    url = f'https://drive.google.com/uc?id={file_id}'
    gdown.download(url, output_path, quiet=False)

# Tải mô hình CNN
def download_model():
    model_file_id = 'your_model_file_id_here'  # Thay bằng ID thực tế
    output_path = 'models/cnn_emotion_best.h5'
    if not os.path.exists(output_path):
        download_from_drive(model_file_id, output_path)
    return output_path

# Tải label_encoder
def download_label_encoder():
    encoder_file_id = 'your_encoder_file_id_here'  # Thay bằng ID thực tế
    output_path = 'models/label_encoder.pkl'
    if not os.path.exists(output_path):
        download_from_drive(encoder_file_id, output_path)
    return output_path

# Load mô hình CNN và encoder
def load_model_and_encoder():
    if not os.path.exists('models/cnn_emotion_best.h5'):
        download_model()

    if not os.path.exists('models/label_encoder.pkl'):
        download_label_encoder()

    model = load_model('models/cnn_emotion_best.h5')
    with open('models/label_encoder.pkl', 'rb') as f:
        encoder = pickle.load(f)

    return model, encoder

# Hàm trích xuất log-mel spectrogram từ file âm thanh
def extract_log_mel(file_path, sr=16000, n_mels=128, n_frames=128):
    try:
        y, sr = librosa.load(file_path, sr=sr)
        max_len = sr * 3  # 3 giây
        if len(y) > max_len:
            y = y[:max_len]
        else:
            pad_width = max_len - len(y)
            y = np.pad(y, (0, pad_width))

        S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=n_mels, n_fft=1024, hop_length=512)
        S_db = librosa.power_to_db(S, ref=np.max)

        if S_db.shape[1] < n_frames:
            pad_width = n_frames - S_db.shape[1]
            S_db = np.pad(S_db, ((0, 0), (0, pad_width)), mode="constant")
        elif S_db.shape[1] > n_frames:
            S_db = S_db[:, :n_frames]

        return S_db
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

# Dự đoán cảm xúc từ âm thanh
def predict_emotion_from_audio(model, audio_path):
    mel = extract_log_mel(audio_path)
    if mel is None:
        return None
    mel = mel[np.newaxis, ..., np.newaxis]   # (1, 128, 128, 1)
    probs = model.predict(mel)[0]
    return probs
