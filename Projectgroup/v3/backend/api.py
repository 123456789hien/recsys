from flask import Flask, request, jsonify
from emotion_model import load_model_and_encoder, predict_emotion_from_audio
from recommender import mindmood_recommend, build_item_matrix
import numpy as np

app = Flask(__name__)

# Load mô hình và encoder
model, encoder = load_model_and_encoder()

# Load dữ liệu nội dung
content_df = pd.read_csv('data/content_items.csv')
item_matrix = build_item_matrix(content_df)

# Định nghĩa API endpoint
@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.get_json()
    
    # Lấy text và audio từ người dùng
    user_text = data.get('text', '')
    audio_path = data.get('audio', None)
    
    # Dự đoán cảm xúc từ text và audio
    text_probs = predict_emotion_from_text(user_text)  # Hàm dự đoán từ text (cần cài riêng)
    audio_probs = predict_emotion_from_audio(model, audio_path)
    
    # Kết hợp cảm xúc từ audio và text
    final_probs = 0.7 * audio_probs + 0.3 * text_probs  # α = 0.7 cho audio, 0.3 cho text
    
    # Gợi ý dựa trên cảm xúc
    recommendations = mindmood_recommend(final_probs, item_matrix)
    
    return jsonify(recommendations)

if __name__ == '__main__':
    app.run(debug=True)
