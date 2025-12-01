# backend/api.py

import os
import uuid
import tempfile
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import numpy as np

from .emotion_model import hybrid_emotion, OUR_CLASSES
from .recommender import load_content_items, build_item_matrix


# ===== 1. Khởi tạo FastAPI =====

app = FastAPI(title="MindMood Emotion Recommender API")

# Cho phép frontend React/Streamlit gọi từ localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # sau này bạn có thể siết chặt lại
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== 2. Load dữ liệu và chuẩn bị recommender =====

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_CSV = os.path.join(BASE_DIR, "data", "content_items.csv")

content_df = load_content_items(CONTENT_CSV)
item_matrix = build_item_matrix(content_df)


# ===== 3. Pydantic models cho request/response =====

class RecommendationItem(BaseModel):
    item_id: int
    title: str
    type: str
    description: str
    emotion_target: str
    score: float


class RecommendResponse(BaseModel):
    emotion_label: str
    emotion_profile: List[float]
    source: str
    recommendations: List[RecommendationItem]
    debug: Optional[dict] = None


# ===== 4. Health check =====

@app.get("/health")
def health_check():
    return {"status": "ok"}


# ===== 5. Endpoint /recommend =====

@app.post("/recommend", response_model=RecommendResponse)
async def recommend(
    text: Optional[str] = Form(None),
    alpha_audio: float = Form(0.7),
    top_k: int = Form(5),
    audio: Optional[UploadFile] = File(None),
):
    """
    Nhận:
      - text: trạng thái cảm xúc hiện tại của user
      - audio: file wav optional
      - alpha_audio: trọng số audio trong hybrid
      - top_k: số recommendation trả về

    Trả:
      - emotion_label
      - emotion_profile
      - danh sách recommendations
    """
    if text is None and audio is None:
        return {
            "emotion_label": "Neutral",
            "emotion_profile": [0, 0, 0, 1, 0],
            "source": "none",
            "recommendations": [],
            "debug": {"error": "No input provided"}
        }

    temp_path = None

    # Lưu audio tạm nếu có
    if audio is not None:
        suffix = os.path.splitext(audio.filename)[1] or ".wav"
        tmp_fd, temp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(await audio.read())

    try:
        emotion_label, profile, source, debug = hybrid_emotion(
            audio_path=temp_path,
            user_text=text,
            alpha_audio=alpha_audio
        )

        recs_df = mindmood_recommend(
            emotion_profile=profile,
            content_df=content_df,
            item_matrix=item_matrix,
            top_k=top_k
        )

        rec_items = [
            RecommendationItem(
                item_id=int(row["item_id"]),
                title=row["title"],
                type=row["type"],
                description=row["description"],
                emotion_target=row["emotion_target"],
                score=float(row["score"])
            )
            for _, row in recs_df.iterrows()
        ]

        return RecommendResponse(
            emotion_label=emotion_label,
            emotion_profile=profile,
            source=source,
            recommendations=rec_items,
            debug=debug
        )
    finally:
        # Xóa file tạm
        if temp_path is not None and os.path.exists(temp_path):
            os.remove(temp_path)


# Import ở cuối để tránh circular import
from .recommender import mindmood_recommend  # noqa
