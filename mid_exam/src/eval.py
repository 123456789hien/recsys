# src/eval.py
import pandas as pd
import numpy as np
from scipy.sparse import coo_matrix
from sklearn.model_selection import train_test_split
from implicit.als import AlternatingLeastSquares
from collections import defaultdict
import joblib
from pathlib import Path
from src.model import build_sparse

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
MODEL_DIR = ROOT / "models"

def time_based_leave_one_out(interactions):
    # For each user, keep the latest interaction as test
    interactions = interactions.sort_values(["user_idx", "timestamp"])
    train_list = []
    test_list = []
    for uid, group in interactions.groupby("user_idx"):
        if len(group) == 1:
            train_list.append(group.iloc[0])
        else:
            test_list.append(group.iloc[-1])
            train_list.append(group.iloc[:-1])
    train = pd.concat([pd.DataFrame(x).T if isinstance(x, dict) else x for x in train_list]) \
             if len(train_list) else interactions.iloc[0:0]
    # The code above is a bit verbose. Simpler approach:
    idx_last = interactions.groupby("user_idx")["timestamp"].idxmax()
    test = interactions.loc[idx_last]
    train = interactions.drop(idx_last)
    return train.reset_index(drop=True), test.reset_index(drop=True)

def precision_at_k(recommended, ground_truth, k=5):
    # recommended: list of item_idx
    # ground_truth: set of item_idx
    if len(recommended) == 0:
        return 0.0
    rec_k = recommended[:k]
    return len([i for i in rec_k if i in ground_truth]) / k

def evaluate_model(model, train_df, test_df, k=5):
    # build user_items matrix for filter
    user_items = train_df.groupby("user_idx")["item_idx"].apply(set).to_dict()
    precisions = []
    for _, row in test_df.iterrows():
        uid = row["user_idx"]
        true_i = {row["item_idx"]}
        user_item_list = user_items.get(uid, set())
        # convert to sparse vector required by implicit.recommend: model.recommend expects user_items as list of (item_idx, rating)
        recs = model.recommend(userid=uid, user_items=None, N=k, filter_already_liked_items=True)
        rec_items = [r[0] for r in recs]
        precisions.append(precision_at_k(rec_items, true_i, k=k))
    return np.mean(precisions)

if __name__ == "__main__":
    interactions = pd.read_parquet(PROC / "interactions.parquet")
    train, test = time_based_leave_one_out(interactions)
    # build mat from train
    from scipy.sparse import coo_matrix
    users = train["user_idx"].values
    items = train["item_idx"].values
    data = train["event_weight"].values
    mat = coo_matrix((data, (items, users)))
    model = AlternatingLeastSquares(factors=40, regularization=0.05, iterations=15)
    model.fit(mat)
    print("Evaluating...")
    p5 = evaluate_model(model, train, test, k=5)
    print("Precision@5:", p5)
