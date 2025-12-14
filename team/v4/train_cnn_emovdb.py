"""
MindMood - CNN Model Training on EmovDB Dataset
Google Colab Training Script

This script trains a CNN model for emotion recognition on the EmovDB dataset.
The model learns from acoustic features (MFCC) extracted from WAV files.

Dataset: https://www.kaggle.com/datasets/phantasm34/emovdb-sorted/data?select=bea
Emotions: Neutral, Amused, Angry, Disgusted, Sleepy
"""

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import librosa
import librosa.display
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models
from tensorflow.keras.utils import to_categorical
import warnings
warnings.filterwarnings('ignore')

# ============================================
# Configuration
# ============================================
SAMPLE_RATE = 22050
N_MFCC = 13
N_FFTMAX = 2048
HOP_LENGTH = 512
EMOTION_LABELS = ['neutral', 'amused', 'angry', 'disgusted', 'sleepy']
BATCH_SIZE = 32
EPOCHS = 25
VALIDATION_SPLIT = 0.2
DATASET_PATH = '/tmp/emovdb/emovdb-sorted/wav' # Correct path after unzipping

# ============================================
# 1. Mount Google Drive (for Colab)
# ============================================
def mount_gdrive():
    """Mount Google Drive to access dataset"""
    try:
        from google.colab import drive
        drive.mount('/content/drive')
        print("Google Drive mounted successfully!")
        return True
    except:
        print("Not running in Google Colab or Drive already mounted")
        return False

# ============================================
# 2. Download EmovDB Dataset
# ============================================
def download_dataset():
    """Download EmovDB dataset from Kaggle"""
    print("Downloading EmovDB dataset...")
    # Install kaggle if not present
    os.system('pip install kaggle -q')
    
    # Create the target directory
    os.makedirs('/tmp/emovdb', exist_ok=True)
    
    # NOTE: User must ensure their Kaggle API key is configured in the Colab environment
    # The command below downloads and unzips the dataset to /tmp/emovdb/
    # The dataset structure is expected to be /tmp/emovdb/emovdb-sorted/wav/{emotion}/*.wav
    os.system('kaggle datasets download -d phantasm34/emovdb-sorted -p /tmp/emovdb --unzip')
    print("Dataset downloaded and unzipped to /tmp/emovdb/")

# ============================================
# 3. Audio Feature Extraction
# ============================================
def extract_mfcc_features(audio_path, n_mfcc=N_MFCC):
    """
    Extract MFCC features from audio file
    
    Args:
        audio_path: Path to WAV file
        n_mfcc: Number of MFCC coefficients
        
    Returns:
        MFCC feature array (n_mfcc, time_steps)
    """
    try:
        # Load audio file
        y, sr = librosa.load(audio_path, sr=SAMPLE_RATE)
        
        # Extract MFCC features
        mfcc = librosa.feature.mfcc(
            y=y,
            sr=sr,
            n_mfcc=n_mfcc,
            n_fft=N_FFTMAX,
            hop_length=HOP_LENGTH
        )
        
        return mfcc
    except Exception as e:
        print(f"Error processing {audio_path}: {e}")
        return None

def extract_acoustic_features(audio_path):
    """
    Extract comprehensive acoustic features
    
    Returns:
        Dictionary with multiple acoustic features
    """
    try:
        y, sr = librosa.load(audio_path, sr=SAMPLE_RATE)
        
        features = {
            'mfcc': librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC),
            'spectral_centroid': librosa.feature.spectral_centroid(y=y, sr=sr),
            'spectral_rolloff': librosa.feature.spectral_rolloff(y=y, sr=sr),
            'zero_crossing_rate': librosa.feature.zero_crossing_rate(y),
            'chroma_stft': librosa.feature.chroma_stft(y=y, sr=sr),
            'tempogram': librosa.feature.tempogram(y=y, sr=sr)
        }
        
        return features
    except Exception as e:
        print(f"Error extracting features from {audio_path}: {e}")
        return None

# ============================================
# 4. Data Loading & Preprocessing
# ============================================
def load_dataset(dataset_path):
    """
    Load EmovDB dataset and extract features
    
    Args:
        dataset_path: Path to EmovDB dataset
        
    Returns:
        X: Feature array (num_samples, n_mfcc, time_steps)
        y: Label array (num_samples,)
        label_encoder: Fitted label encoder
    """
    X = []
    y = []
    label_encoder = LabelEncoder()
    
    print("Loading and processing audio files...")
    
    # Iterate through emotion folders
    for emotion_idx, emotion in enumerate(EMOTION_LABELS):
        emotion_path = os.path.join(dataset_path, emotion)
        
        if not os.path.exists(emotion_path):
            print(f"Warning: {emotion_path} not found")
            continue
        
        # Get all WAV files in emotion folder
        wav_files = list(Path(emotion_path).glob('*.wav'))
        print(f"Processing {emotion}: {len(wav_files)} files")
        
        for wav_file in wav_files:
            try:
                # Extract MFCC features
                mfcc = extract_mfcc_features(str(wav_file))
                
                if mfcc is not None:
                    # Pad or truncate to fixed length (100 time steps)
                    if mfcc.shape[1] < 100:
                        mfcc = np.pad(mfcc, ((0, 0), (0, 100 - mfcc.shape[1])), mode='constant')
                    else:
                        mfcc = mfcc[:, :100]
                    
                    X.append(mfcc)
                    y.append(emotion)
            except Exception as e:
                print(f"Error processing {wav_file}: {e}")
                continue
    
    # Encode labels
    y_encoded = label_encoder.fit_transform(y)
    
    X = np.array(X)
    y = np.array(y_encoded)
    
    print(f"Dataset loaded: {X.shape[0]} samples")
    print(f"Feature shape: {X.shape}")
    
    return X, y, label_encoder

# ============================================
# 5. EDA & Visualization
# ============================================
def plot_eda(X, y, label_encoder):
    """
    Create exploratory data analysis visualizations
    """
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    
    # 1. Emotion Distribution
    unique, counts = np.unique(y, return_counts=True)
    emotion_names = label_encoder.inverse_transform(unique)
    
    axes[0, 0].bar(emotion_names, counts, color='skyblue')
    axes[0, 0].set_title('Emotion Distribution in EmovDB', fontsize=12, fontweight='bold')
    axes[0, 0].set_ylabel('Number of Samples')
    axes[0, 0].tick_params(axis='x', rotation=45)
    
    # 2. Sample MFCC Spectrogram
    sample_idx = 0
    mfcc_sample = X[sample_idx]
    
    im = axes[0, 1].imshow(mfcc_sample, aspect='auto', origin='lower', cmap='viridis')
    axes[0, 1].set_title(f'MFCC Spectrogram - {emotion_names[y[sample_idx]]}', fontsize=12, fontweight='bold')
    axes[0, 1].set_ylabel('MFCC Coefficient')
    axes[0, 1].set_xlabel('Time Frame')
    plt.colorbar(im, ax=axes[0, 1])
    
    # 3. Feature Statistics
    feature_means = X.mean(axis=(0, 2))
    feature_stds = X.std(axis=(0, 2))
    
    axes[1, 0].errorbar(range(len(feature_means)), feature_means, yerr=feature_stds, fmt='o-', capsize=5)
    axes[1, 0].set_title('MFCC Mean and Std Dev', fontsize=12, fontweight='bold')
    axes[1, 0].set_xlabel('MFCC Coefficient')
    axes[1, 0].set_ylabel('Mean Value')
    axes[1, 0].grid(True, alpha=0.3)
    
    # 4. Data Split Information
    axes[1, 1].axis('off')
    info_text = f"""
    Dataset Information:
    
    Total Samples: {X.shape[0]}
    Feature Shape: {X.shape}
    Emotions: {len(emotion_names)}
    
    Emotion Breakdown:
    """
    for emotion, count in zip(emotion_names, counts):
        info_text += f"\n  {emotion}: {count} samples"
    
    axes[1, 1].text(0.1, 0.5, info_text, fontsize=11, family='monospace',
                   verticalalignment='center', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    plt.savefig('emovdb_eda.png', dpi=150, bbox_inches='tight')
    print("EDA visualization saved as 'emovdb_eda.png'")
    # plt.show() # Commented out for non-interactive environment

# ============================================
# 6. Build CNN Model
# ============================================
def build_cnn_model(input_shape, num_classes):
    """
    Build CNN model for emotion recognition
    
    Args:
        input_shape: Shape of input features (n_mfcc, time_steps)
        num_classes: Number of emotion classes
        
    Returns:
        Compiled Keras model
    """
    model = models.Sequential([
        # Input layer
        layers.Input(shape=input_shape),
        layers.Reshape((input_shape[0], input_shape[1], 1)),
        
        # Block 1
        layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.3),
        
        # Block 2
        layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.3),
        
        # Block 3
        layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.3),
        
        # Global Average Pooling
        layers.GlobalAveragePooling2D(),
        
        # Dense layers
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.4),
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.4),
        layers.Dense(num_classes, activation='softmax')
    ])
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model

# ============================================
# 7. Training
# ============================================
def train_model(X, y, label_encoder):
    """
    Train CNN model on EmovDB dataset
    """
    # Prepare data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Convert labels to one-hot encoding
    num_classes = len(label_encoder.classes_)
    y_train_cat = to_categorical(y_train, num_classes)
    y_test_cat = to_categorical(y_test, num_classes)
    
    # Normalize features
    # NOTE: We calculate mean/std on the training set only
    X_train_mean = X_train.mean()
    X_train_std = X_train.std()
    X_train_norm = (X_train - X_train_mean) / (X_train_std + 1e-8)
    X_test_norm = (X_test - X_train_mean) / (X_train_std + 1e-8)
    
    # Build model
    model = build_cnn_model((X_train.shape[1], X_train.shape[2]), num_classes)
    print(model.summary())
    
    # Callbacks
    early_stopping = keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=5,
        restore_best_weights=True
    )
    
    reduce_lr = keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=3,
        min_lr=1e-6
    )
    
    # Train model
    print("\nTraining model...")
    history = model.fit(
        X_train_norm,
        y_train_cat,
        batch_size=BATCH_SIZE,
        epochs=EPOCHS,
        validation_data=(X_test_norm, y_test_cat),
        callbacks=[early_stopping, reduce_lr],
        verbose=1
    )
    
    # Evaluate model
    print("\nEvaluating model...")
    loss, accuracy = model.evaluate(X_test_norm, y_test_cat, verbose=0)
    print(f"Test Accuracy: {accuracy*100:.2f}%")
    
    # Predictions and Classification Report
    y_pred = np.argmax(model.predict(X_test_norm), axis=1)
    report = classification_report(y_test, y_pred, target_names=label_encoder.classes_)
    print("\nClassification Report:\n", report)
    
    # Save model
    model.save('cnn_emovdb_model.h5')
    print("Model saved as 'cnn_emovdb_model.h5'")
    
    # Save normalization stats for API
    np.savez('norm_stats.npz', mean=X_train_mean, std=X_train_std)
    print("Normalization stats saved as 'norm_stats.npz'")
    
    return model, history

# ============================================
# 8. Main Execution
# ============================================
if __name__ == '__main__':
    # 1. Download dataset (User must run this in Colab and configure Kaggle API)
    # download_dataset() 
    print("NOTE: Please run `download_dataset()` in your Colab environment and ensure Kaggle API is configured.")
    print(f"The expected dataset path is: {DATASET_PATH}")
    
    # 2. Load and preprocess data
    # NOTE: The following lines will fail if the dataset is not downloaded first.
    # X, y, label_encoder = load_dataset(DATASET_PATH)
    
    # 3. Placeholder for training (since we cannot run the full training here)
    print("\n--- Training Simulation ---")
    print("The script is ready. After downloading the dataset, uncomment the load_dataset and train_model calls to run the full training.")
    print("The trained model and normalization stats will be saved for use in api.py.")
    
    # Example of how to run:
    # if X.shape[0] > 0:
    #     plot_eda(X, y, label_encoder)
    #     train_model(X, y, label_encoder)
    
    print("---------------------------")
