# src/eda.py
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
REPORT = ROOT / "reports" / "eda"
REPORT.mkdir(parents=True, exist_ok=True)

def load():
    interactions = pd.read_parquet(PROC / "interactions.parquet")
    items = pd.read_csv(PROC / "items_clean.csv")
    return interactions, items

def plot_interactions_per_user(interactions):
    counts = interactions.groupby("user_idx").size()
    plt.figure(figsize=(6,4))
    sns.histplot(counts, bins=50, log_scale=(True, False))
    plt.title("Interactions per user (log-scale on x)")
    plt.xlabel("Interactions")
    plt.ylabel("Number of users")
    plt.tight_layout()
    plt.savefig(REPORT / "interactions_per_user.png")
    plt.close()

def plot_price_boxplot(items, interactions):
    merged = interactions.merge(items[["item_idx","price","category"]], on="item_idx", how="left")
    plt.figure(figsize=(8,4))
    sns.boxplot(x="category", y="price", data=merged.sample(frac=0.2, random_state=42))
    plt.xticks(rotation=45)
    plt.title("Price by category (sampled)")
    plt.tight_layout()
    plt.savefig(REPORT / "price_by_category.png")
    plt.close()

def plot_category_heatmap(interactions, items):
    df = interactions.copy()
    df["hour"] = df["timestamp"].dt.hour
    merged = df.merge(items[["item_idx","category"]], on="item_idx", how="left")
    table = merged.pivot_table(index="category", columns="hour", values="user_idx", aggfunc="count", fill_value=0)
    plt.figure(figsize=(10,6))
    sns.heatmap(table, cmap="viridis")
    plt.title("Category × Hour heatmap")
    plt.tight_layout()
    plt.savefig(REPORT / "category_hour_heatmap.png")
    plt.close()

def run_all():
    interactions, items = load()
    plot_interactions_per_user(interactions)
    plot_price_boxplot(items, interactions)
    plot_category_heatmap(interactions, items)
    # summary
    print("EDA done. Check reports/eda for PNGs.")

if __name__ == "__main__":
    run_all()
