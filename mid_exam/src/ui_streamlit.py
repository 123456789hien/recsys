# src/ui_streamlit.py
import streamlit as st
import pandas as pd
import joblib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
MODEL_DIR = ROOT / "models"

@st.cache_data
def load_items():
    return pd.read_csv(PROC / "items_clean.csv")

@st.cache_resource
def load_model():
    return joblib.load(MODEL_DIR / "als_model.joblib")

items = load_items()
model = None
st.title("Personalised Fashion Recommender — Demo PoC")

uploaded = st.file_uploader("(Optional) Upload interactions.csv to override data", type=["csv"])
if uploaded:
    st.info("Re-run backend scripts to retrain model after uploading new data.")
st.sidebar.header("Input")
user_id = st.sidebar.number_input("User index (user_idx)", min_value=0, step=1, value=0)
k = st.sidebar.slider("Top K", 1, 20, 10)

if st.button("Load model and show recommendations"):
    model = load_model()
    try:
        # In case no user_items provided, pass None (implicit lib will approximate)
        recs = model.recommend(userid=user_id, user_items=None, N=k, filter_already_liked_items=True)
        # recs is list of (item_idx, score)
        rec_df = pd.DataFrame(recs, columns=["item_idx","score"])
        rec_df = rec_df.merge(items, on="item_idx", how="left")
        st.write(f"Top {k} recommendations for user {user_id}")
        for _, r in rec_df.iterrows():
            st.markdown(f"**{r.get('title', 'Item ' + str(int(r.item_idx)))}** — score: {r.score:.3f}")
            st.write(f"Category: {r.get('category','-')} — Price: {r.get('price', '-')}")
            st.write("---")
    except Exception as e:
        st.error(f"Error recommending: {e}")
