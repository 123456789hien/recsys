# backend/recommender.py

import os
import numpy as np
import pandas as pd

# Giữ đúng thứ tự với emotion_model.OUR_CLASSES
EMOTION_ORDER = ["Amused", "Angry", "Disgusted", "Neutral", "Sleepy"]


def load_content_items(csv_path=None):
    """
    Nếu có data/content_items.csv thì load
    nếu không có thì dùng sample items hard-code.
    """
    if csv_path is not None and os.path.exists(csv_path):
        return pd.read_csv(csv_path)

    # Sample cho demo, bạn có thể chỉnh sửa và đưa vào CSV
    data = [
        {
            "item_id": 1,
            "title": "5-minute calming breathing",
            "type": "exercise",
            "description": "Short guided breathing to reduce stress and calm your nervous system",
            "emotion_target": "Angry"
        },
        {
            "item_id": 2,
            "title": "Gentle sleep meditation",
            "type": "meditation",
            "description": "Soft voice guidance to help you unwind and fall asleep peacefully",
            "emotion_target": "Sleepy"
        },
        {
            "item_id": 3,
            "title": "Energy-boost happy playlist",
            "type": "music",
            "description": "Upbeat positive tracks to lift your mood",
            "emotion_target": "Amused"
        },
        {
            "item_id": 4,
            "title": "Grounding body scan",
            "type": "meditation",
            "description": "Scan through your body to release tension and come back to the present moment",
            "emotion_target": "Neutral"
        },
        {
            "item_id": 5,
            "title": "Journaling prompt pack",
            "type": "journal",
            "description": "Guided prompts to process intense emotions in a safe structured way",
            "emotion_target": "Angry"
        },
        {
            "item_id": 6,
            "title": "Slow mindful stretching",
            "type": "exercise",
            "description": "Gentle stretching to relax your muscles and regulate your breathing",
            "emotion_target": "Neutral"
        },
        {
            "item_id": 7,
            "title": "Cooling down after conflict",
            "type": "exercise",
            "description": "A structured way to cool down after an argument and regain control",
            "emotion_target": "Angry"
        },
        {
            "item_id": 8,
            "title": "Quiet focus playlist",
            "type": "music",
            "description": "Low distraction tracks to help you focus and stabilize your mood",
            "emotion_target": "Neutral"
        },
        {
            "item_id": 9,
            "title": "Light amusement video suggestion",
            "type": "video",
            "description": "Watch something light and funny to gently lift your mood without overstimulation",
            "emotion_target": "Amused"
        },
    ]
    return pd.DataFrame(data)


def build_item_matrix(content_df):
    """
    Xây ma trận item x emotion đơn giản one-hot theo emotion_target.
    """
    item_vectors = []
    for _, row in content_df.iterrows():
        vec = np.zeros(len(EMOTION_ORDER), dtype=np.float32)
        if row["emotion_target"] in EMOTION_ORDER:
            idx = EMOTION_ORDER.index(row["emotion_target"])
            vec[idx] = 1.0
        item_vectors.append(vec)

    item_matrix = np.stack(item_vectors, axis=0)  # (n_items, n_emotions)
    return item_matrix


def mindmood_recommend(emotion_profile, content_df, item_matrix, top_k=5):
    """
    emotion_profile: list hoặc np.array shape (5,) theo EMOTION_ORDER
    content_df: DataFrame chứa items
    item_matrix: np.array (n_items, 5)
    """
    profile = np.array(emotion_profile, dtype=np.float32)

    # cosine similarity đơn giản với one-hot vector = dot product
    scores = item_matrix @ profile  # (n_items,)

    content_df = content_df.copy()
    content_df["score"] = scores

    recs = content_df.sort_values("score", ascending=False).head(top_k)
    return recs.reset_index(drop=True)
