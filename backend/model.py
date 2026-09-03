"""
Graph Attention Network (GAT) based location recommender.

This mirrors the methodology from GAT_Based.ipynb (same seed, same synthetic
dataset shape, same GAT architecture and training loop) but restructures it
into a reusable, cacheable module that a web API can serve, instead of a
notebook that blocks on input().
"""
import os
import json
from collections import Counter

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import LabelEncoder
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics.pairwise import cosine_similarity
from torch_geometric.data import Data
from torch_geometric.nn import GATConv

SEED = 42
NUM_PLACES = 5000
NUM_USERS = 200
PLACE_TYPES = ["waterfall", "temple", "beach", "monument", "hill", "lake"]
VISITS_PER_USER = 10
NEIGHBORS_PER_PLACE = 10
EPOCHS = 30
LR = 0.01

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PLACES_PATH = os.path.join(DATA_DIR, "places.csv")
INTERACTIONS_PATH = os.path.join(DATA_DIR, "interactions.csv")
EMBEDDINGS_PATH = os.path.join(DATA_DIR, "embeddings.npy")
NEIGHBORS_PATH = os.path.join(DATA_DIR, "place_neighbors.npy")
LOSS_PATH = os.path.join(DATA_DIR, "loss_history.json")


class GAT(nn.Module):
    """Same architecture as the notebook: 2 attention heads on layer 1
    (report describes head 1 ~ spatial similarity, head 2 ~ type similarity),
    then a second GATConv that merges heads back to a 64-dim embedding."""

    def __init__(self):
        super().__init__()
        self.conv1 = GATConv(4, 64, heads=2)
        self.conv2 = GATConv(128, 64)

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index).relu()
        x = self.conv2(x, edge_index)
        return x


class Recommender:
    def __init__(self):
        self.places: pd.DataFrame | None = None
        self.interactions: pd.DataFrame | None = None
        self.embeddings: np.ndarray | None = None
        self.place_neighbors: np.ndarray | None = None
        self.loss_history: list[dict] = []
        self.ready = False

    # ------------------------------------------------------------------
    # Dataset + graph construction (same logic as the notebook)
    # ------------------------------------------------------------------
    def _build_dataset(self):
        np.random.seed(SEED)

        places = pd.DataFrame({
            "id": range(NUM_PLACES),
            "type": np.random.choice(PLACE_TYPES, NUM_PLACES),
            "lat": np.random.uniform(10, 30, NUM_PLACES),
            "lon": np.random.uniform(70, 90, NUM_PLACES),
            "rating": np.random.uniform(3, 5, NUM_PLACES),
        })

        interactions = []
        for user in range(NUM_USERS):
            visited = np.random.choice(places["id"], size=VISITS_PER_USER, replace=False)
            for p in visited:
                interactions.append([user, int(p)])
        interactions = pd.DataFrame(interactions, columns=["user", "place"])

        le = LabelEncoder()
        places["type_enc"] = le.fit_transform(places["type"])

        self.places = places
        self.interactions = interactions

    def _build_graph(self):
        place_features = self.places[["type_enc", "lat", "lon", "rating"]].values
        user_features = np.zeros((NUM_USERS, 4))
        features = np.vstack([user_features, place_features])

        edges = []
        for _, row in self.interactions.iterrows():
            u = row["user"]
            p = row["place"] + NUM_USERS
            edges.append([u, p])
            edges.append([p, u])

        coords = self.places[["lat", "lon"]].values
        nbrs = NearestNeighbors(n_neighbors=NEIGHBORS_PER_PLACE).fit(coords)
        _, indices = nbrs.kneighbors(coords)
        self.place_neighbors = indices

        for i in range(NUM_PLACES):
            for j in indices[i]:
                edges.append([i + NUM_USERS, int(j) + NUM_USERS])

        edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()
        x = torch.tensor(features, dtype=torch.float)
        self.data = Data(x=x, edge_index=edge_index)

    def _train(self):
        torch.manual_seed(SEED)
        model = GAT()
        optimizer = torch.optim.Adam(model.parameters(), lr=LR)

        history = []
        for epoch in range(EPOCHS):
            optimizer.zero_grad()
            emb = model(self.data.x, self.data.edge_index)
            loss = (emb ** 2).mean()
            loss.backward()
            optimizer.step()
            history.append({"epoch": epoch, "loss": float(loss.item())})

        model.eval()
        with torch.no_grad():
            emb = model(self.data.x, self.data.edge_index)

        self.loss_history = history
        self.embeddings = emb.numpy()

    # ------------------------------------------------------------------
    # Persistence so the server doesn't retrain on every restart
    # ------------------------------------------------------------------
    def _save_cache(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self.places.to_csv(PLACES_PATH, index=False)
        self.interactions.to_csv(INTERACTIONS_PATH, index=False)
        np.save(EMBEDDINGS_PATH, self.embeddings)
        np.save(NEIGHBORS_PATH, self.place_neighbors)
        with open(LOSS_PATH, "w") as f:
            json.dump(self.loss_history, f)

    def _load_cache(self) -> bool:
        paths = [PLACES_PATH, INTERACTIONS_PATH, EMBEDDINGS_PATH, NEIGHBORS_PATH, LOSS_PATH]
        if not all(os.path.exists(p) for p in paths):
            return False
        self.places = pd.read_csv(PLACES_PATH)
        self.interactions = pd.read_csv(INTERACTIONS_PATH)
        self.embeddings = np.load(EMBEDDINGS_PATH)
        self.place_neighbors = np.load(NEIGHBORS_PATH)
        with open(LOSS_PATH) as f:
            self.loss_history = json.load(f)
        return True

    def load_or_train(self, force: bool = False):
        if not force and self._load_cache():
            self.ready = True
            return
        self._build_dataset()
        self._build_graph()
        self._train()
        self._save_cache()
        self.ready = True

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------
    def _place_row(self, place_id: int) -> dict:
        row = self.places.iloc[place_id]
        return {
            "id": int(row["id"]),
            "type": row["type"],
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "rating": round(float(row["rating"]), 2),
        }

    def explain(self, user_id: int, place_id: int) -> list[str]:
        place = self.places.iloc[place_id]
        visited = self.interactions[self.interactions["user"] == user_id]["place"].values

        reasons = []
        for v in visited:
            visited_place = self.places.iloc[int(v)]
            if visited_place["type"] == place["type"]:
                reasons.append(f"Similar type: {place['type']}")
            dist = abs(visited_place["lat"] - place["lat"]) + abs(visited_place["lon"] - place["lon"])
            if dist < 2:
                reasons.append("Nearby a place you visited")

        if not reasons:
            reasons.append("High similarity in graph embeddings")

        # de-duplicate, keep order
        seen = set()
        deduped = []
        for r in reasons:
            if r not in seen:
                seen.add(r)
                deduped.append(r)
        return deduped

    def visited_places(self, user_id: int) -> list[dict]:
        user_emb = self.embeddings[user_id]
        scores = cosine_similarity([user_emb], self.embeddings)[0]
        place_scores = scores[NUM_USERS:]

        visited = self.interactions[self.interactions["user"] == user_id]["place"].values
        out = []
        for idx in visited:
            idx = int(idx)
            place = self._place_row(idx)
            place["similarity"] = round(float(place_scores[idx]), 4)
            out.append(place)
        return out

    def recommend(self, user_id: int, top_k: int = 5) -> list[dict]:
        user_emb = self.embeddings[user_id]
        scores = cosine_similarity([user_emb], self.embeddings)[0]
        place_scores = scores[NUM_USERS:].copy()

        visited = self.interactions[self.interactions["user"] == user_id]["place"].values
        visited_ids = set(int(v) for v in visited)

        if len(visited) > 0:
            visited_types = [self.places.iloc[int(idx)]["type"] for idx in visited]
            type_counts = Counter(visited_types)
            total = sum(type_counts.values())
            type_weights = {t: c / total for t, c in type_counts.items()}

            place_types = self.places["type"].values
            for i in range(len(place_scores)):
                w = type_weights.get(place_types[i])
                if w:
                    place_scores[i] += 0.1 * w

        # Exclude places already visited -- recommending a visited place
        # again isn't useful; the notebook version didn't filter this out.
        order = place_scores.argsort()[::-1]
        results = []
        for idx in order:
            idx = int(idx)
            if idx in visited_ids:
                continue
            place = self._place_row(idx)
            place["score"] = round(float(place_scores[idx]), 4)
            place["reasons"] = self.explain(user_id, idx)
            results.append(place)
            if len(results) >= top_k:
                break
        return results

    def similar_places(self, place_id: int, top_k: int = 6) -> list[dict]:
        """Place -> place recommendations using the precomputed spatial
        nearest-neighbor graph edges (not present in the notebook UI)."""
        neighbor_ids = self.place_neighbors[place_id]
        out = []
        for idx in neighbor_ids:
            idx = int(idx)
            if idx == place_id:
                continue
            out.append(self._place_row(idx))
            if len(out) >= top_k:
                break
        return out

    def user_profile(self, user_id: int) -> dict:
        visited = self.interactions[self.interactions["user"] == user_id]["place"].values
        types = [self.places.iloc[int(idx)]["type"] for idx in visited]
        counts = Counter(types)
        return {
            "user_id": user_id,
            "visited_count": len(visited),
            "type_breakdown": [{"type": t, "count": c} for t, c in counts.most_common()],
        }

    def stats(self) -> dict:
        type_counts = self.places["type"].value_counts().to_dict()
        return {
            "num_places": int(len(self.places)),
            "num_users": NUM_USERS,
            "num_interactions": int(len(self.interactions)),
            "place_types": PLACE_TYPES,
            "type_distribution": [{"type": t, "count": int(c)} for t, c in type_counts.items()],
            "avg_rating": round(float(self.places["rating"].mean()), 3),
            "loss_history": self.loss_history,
            "embedding_dim": int(self.embeddings.shape[1]) if self.embeddings is not None else 0,
        }

    def list_places(self, place_type=None, min_rating=None, search=None, limit=50, offset=0):
        df = self.places
        if place_type:
            df = df[df["type"] == place_type]
        if min_rating is not None:
            df = df[df["rating"] >= min_rating]
        if search:
            df = df[df["type"].str.contains(search, case=False)]
        total = int(len(df))
        page = df.iloc[offset: offset + limit]
        items = [self._place_row(int(row["id"])) for _, row in page.iterrows()]
        return items, total

    def graph_subgraph(self, n_nodes: int = 60, max_edges: int = 250) -> dict:
        """Sample a connected slice of the graph: some users plus the places
        they visited (plus place-place edges between those places).

        A plain "first n node ids" slice (the notebook's approach) puts every
        low id in the user range (ids 0..199), so for any n <= 200 it renders
        only disconnected user dots with zero edges -- not useful to look at.
        """
        n_nodes = min(n_nodes, NUM_USERS + NUM_PLACES)
        num_sample_users = max(1, min(NUM_USERS, n_nodes // 6))
        sample_users = list(range(num_sample_users))

        user_place_edges = []
        included_place_ids = []
        seen_places = set()
        for u in sample_users:
            visited = self.interactions[self.interactions["user"] == u]["place"].values
            for p in visited:
                p = int(p)
                user_place_edges.append((u, p))
                if p not in seen_places:
                    seen_places.add(p)
                    included_place_ids.append(p)

        remaining_budget = max(0, n_nodes - num_sample_users)
        included_place_ids = included_place_ids[:remaining_budget]
        included_place_set = set(included_place_ids)

        nodes = [{"id": u, "kind": "user", "label": f"User {u}"} for u in sample_users]
        for p in included_place_ids:
            row = self.places.iloc[p]
            nodes.append({"id": p + NUM_USERS, "kind": "place", "label": row["type"], "type": row["type"]})

        edges = []
        for u, p in user_place_edges:
            if p in included_place_set:
                edges.append({"source": u, "target": p + NUM_USERS})
            if len(edges) >= max_edges:
                break

        if len(edges) < max_edges:
            for p in included_place_ids:
                for j in self.place_neighbors[p]:
                    j = int(j)
                    if j != p and j in included_place_set:
                        edges.append({"source": p + NUM_USERS, "target": j + NUM_USERS})
                    if len(edges) >= max_edges:
                        break
                if len(edges) >= max_edges:
                    break

        return {"nodes": nodes, "edges": edges}


recommender = Recommender()
