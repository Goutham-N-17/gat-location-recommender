# Graph-Based Location Recommendation System (GAT)

A location recommender built on a **Graph Attention Network (GAT)** over a
bipartite user-place graph, with a FastAPI backend and a React frontend.
This turns the original `GAT_Based.ipynb` notebook (see `Mini_Project_Report.pdf`
for the full write-up) into a runnable web app, per the report's own
"Future Work: Deploy as web application."

## Live demo

`demo/index.html` is a standalone, self-contained page ("Attention Atlas"):
the trained embeddings and dataset are baked into the file and every
recommendation is computed client-side in JavaScript, so it needs no server
and no build step — open the file directly in a browser. It ports the same
recommendation logic as `backend/model.py` (cosine similarity + type-frequency
boost + explanations), plus a place explorer and a force-directed graph view.

## How it works

- **Dataset**: 5,000 synthetic places (waterfall/temple/beach/monument/hill/lake,
  with lat/lon/rating) and 200 users, each having visited 10 places (seeded, so
  it's reproducible).
- **Graph**: bipartite `user -> place` edges from visit history, plus
  `place -> place` edges to each place's 10 nearest neighbors by coordinates.
- **Model**: a 2-layer GAT (`GATConv(4, 64, heads=2)` -> ReLU -> `GATConv(128, 64)`)
  trained unsupervised for 30 epochs (minimizing mean squared embedding norm),
  producing a 64-dim embedding per node.
- **Recommendation**: cosine similarity between a user's embedding and every
  place embedding, boosted by `0.1 * type_weight` where `type_weight` is how
  often the user has visited that place type before, then ranked.
- **Explainability**: each recommendation lists why it was suggested — same
  type as a visited place, near a visited place, or (fallback) "high similarity
  in graph embeddings."

## What's new vs. the notebook

The notebook itself is a script relying on blocking `input()` calls and
Folium/NetworkX static renders — it can't be served or interacted with as an
app. This project adds:

- A FastAPI backend that trains once and **caches** the dataset/embeddings to
  disk (`backend/data/`), so restarts are instant instead of retraining.
- A REST API (users, recommendations, visited history, place search/filter,
  place detail with nearest neighbors, graph subgraph, dataset stats).
- **Recommendations now exclude already-visited places** — the notebook's
  `recommend_for_user` could resurface a place the user had already been to;
  the API filters those out.
- A React frontend: a stats dashboard (place-type distribution, training loss
  curve), a recommendations page with an interactive Leaflet map and
  explanations, a searchable/filterable place explorer with a "similar places"
  panel, and an interactive graph visualization (vis-network) of the
  user-place-place graph.
- Input validation (invalid user/place ids return proper 404s instead of
  crashing on a bad index).

## Project structure

```
backend/
  model.py      # dataset generation, graph construction, GAT model, recommender logic
  app.py        # FastAPI routes
  requirements.txt
  data/         # cached places.csv / interactions.csv / embeddings.npy (generated, gitignored)
frontend/
  src/
    api.js              # backend REST client
    pages/               # Dashboard, Recommendations, Explore, GraphView
    components/          # PlaceCard, MapView, Status
    hooks/useAsync.js
```

## Running locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

First startup builds the graph and trains the GAT (~10-15s on CPU), then
caches results to `backend/data/`. Delete that folder to force a retrain.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`). The frontend
expects the API at `http://localhost:8000`; override with a `VITE_API_URL`
env var if needed.

## API reference

| Endpoint | Description |
|---|---|
| `GET /api/health` | readiness check |
| `GET /api/stats` | dataset counts, type distribution, training loss history |
| `GET /api/users` | all users with visited-place counts |
| `GET /api/users/{id}/visited` | places a user has visited, with similarity scores |
| `GET /api/users/{id}/profile` | visited-type breakdown for a user |
| `GET /api/recommend/{id}?top_k=5` | top-K recommendations with explanations |
| `GET /api/places?type=&min_rating=&search=&limit=&offset=` | paginated/filterable place list |
| `GET /api/places/{id}` | place detail + nearest-neighbor "similar places" |
| `GET /api/graph?n=60` | subgraph (nodes/edges) for visualization |
