# src/model.py
import numpy as np
import pandas as pd
from scipy.sparse import coo_matrix
from implicit.als import AlternatingLeastSquares
import joblib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

def load_interactions():
    return pd.read_parquet(PROC / "interactions.parquet")

def build_sparse(interactions, weight_col="event_weight"):
    # Build item-user matrix for implicit (items x users)
    users = interactions["user_idx"].values
    items = interactions["item_idx"].values
    data = interactions[weight_col].astype(float).values
    n_users = interactions["user_idx"].nunique()
    n_items = interactions["item_idx"].nunique()
    mat = coo_matrix((data, (items, users)), shape=(n_items, n_users))
    return mat, n_users, n_items

def train_als(mat, factors=30, regularization=0.01, iterations=10):
    model = AlternatingLeastSquares(factors=factors,
                                    regularization=regularization,
                                    iterations=iterations,
                                    use_gpu=False)  # set True if GPU available
    # implicit lib expects (item x user) sparse matrix with floats
    model.fit(mat)
    joblib.dump(model, MODEL_DIR / "als_model.joblib")
    print("Saved model to", MODEL_DIR / "als_model.joblib")
    return model

def recommend_for_user(model, user_idx, user_items, N=10):
    # returns list of (item_idx, score)
    recs = model.recommend(userid=user_idx, user_items=user_items, N=N, filter_already_liked_items=True)
    return recs

if __name__ == "__main__":
    interactions = load_interactions()
    mat, n_users, n_items = build_sparse(interactions)
    model = train_als(mat, factors=40, regularization=0.05, iterations=15)
