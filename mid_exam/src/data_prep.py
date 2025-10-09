# src/data_prep.py
import pandas as pd
import numpy as np
import os
from pathlib import Path
from sklearn.preprocessing import LabelEncoder

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
PROC.mkdir(parents=True, exist_ok=True)

def load_raw():
    interactions = pd.read_csv(RAW / "interactions.csv", parse_dates=["timestamp"])
    items = pd.read_csv(RAW / "items.csv")
    # optional users
    try:
        users = pd.read_csv(RAW / "users.csv")
    except FileNotFoundError:
        users = None
    return interactions, items, users

def clean_items(items: pd.DataFrame):
    # Example cleaning
    items = items.drop_duplicates(subset=["item_id"])
    items["category"] = items["category"].fillna("unknown")
    items["brand"] = items.get("brand", pd.Series(["unknown"]*len(items))).fillna("unknown")
    # price numeric
    items["price"] = pd.to_numeric(items.get("price", 0), errors="coerce").fillna(0.0)
    return items

def encode_ids(interactions, items):
    # map user_id and item_id to ints
    u_enc = LabelEncoder()
    i_enc = LabelEncoder()
    interactions = interactions.copy()
    interactions["user_idx"] = u_enc.fit_transform(interactions["user_id"])
    interactions["item_idx"] = i_enc.fit_transform(interactions["item_id"])
    # make mapping in items
    items = items.copy()
    items = items[items["item_id"].isin(interactions["item_id"].unique())]
    items["item_idx"] = i_enc.transform(items["item_id"])
    return interactions, items, u_enc, i_enc

def aggregate_event_weight(interactions: pd.DataFrame):
    # convert event_type to implicit weight (simple heuristic)
    # view -> 1, add_to_cart -> 3, purchase -> 5
    weight_map = {"view": 1.0, "add_to_cart": 3.0, "purchase": 5.0}
    interactions["event_weight"] = interactions["event_type"].map(weight_map).fillna(1.0)
    return interactions

def run():
    interactions, items, users = load_raw()
    items = clean_items(items)
    interactions = aggregate_event_weight(interactions)
    interactions, items, u_enc, i_enc = encode_ids(interactions, items)
    # save
    interactions.to_parquet(PROC / "interactions.parquet", index=False)
    items.to_csv(PROC / "items_clean.csv", index=False)
    print("Saved processed files to", PROC)

if __name__ == "__main__":
    run()
