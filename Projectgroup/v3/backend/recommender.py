import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

# Đọc dữ liệu content_items.csv
content_df = pd.read_csv('data/content_items.csv')

# Xây dựng ma trận gợi ý dựa trên cảm xúc
def build_item_matrix(content_df):
    item_matrix = content_df.pivot_table(index='emotion_target', columns='item_id', values='score')
    return item_matrix

# Gợi ý nội dung tương ứng với cảm xúc
def mindmood_recommend(emotion_profile, item_matrix, top_n=5):
    # Tính toán cosine similarity giữa emotion profile và item embeddings
    similarities = cosine_similarity([emotion_profile], item_matrix)
    sorted_idx = similarities.argsort()[0][::-1]
    
    recommendations = []
    for idx in sorted_idx[:top_n]:
        item = content_df[content_df['item_id'] == item_matrix.columns[idx]].iloc[0]
        recommendations.append({
            'item_id': item['item_id'],
            'title': item['title'],
            'emotion_target': item['emotion_target'],
            'score': similarities[0][idx]
        })
    
    return recommendations
