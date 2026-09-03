from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from model import recommender, NUM_USERS, NUM_PLACES, PLACE_TYPES


@asynccontextmanager
async def lifespan(app: FastAPI):
    recommender.load_or_train()
    yield


app = FastAPI(title="GAT Location Recommender API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _check_ready():
    if not recommender.ready:
        raise HTTPException(status_code=503, detail="Model is still initializing")


def _check_user(user_id: int):
    if user_id < 0 or user_id >= NUM_USERS:
        raise HTTPException(status_code=404, detail=f"user_id must be between 0 and {NUM_USERS - 1}")


def _check_place(place_id: int):
    if place_id < 0 or place_id >= NUM_PLACES:
        raise HTTPException(status_code=404, detail=f"place_id must be between 0 and {NUM_PLACES - 1}")


@app.get("/api/health")
def health():
    return {"status": "ok", "ready": recommender.ready}


@app.get("/api/stats")
def stats():
    _check_ready()
    return recommender.stats()


@app.get("/api/users")
def list_users():
    _check_ready()
    counts = recommender.interactions.groupby("user").size()
    return [
        {"id": int(uid), "visited_count": int(counts.get(uid, 0))}
        for uid in range(NUM_USERS)
    ]


@app.get("/api/users/{user_id}/visited")
def user_visited(user_id: int):
    _check_ready()
    _check_user(user_id)
    return recommender.visited_places(user_id)


@app.get("/api/users/{user_id}/profile")
def user_profile(user_id: int):
    _check_ready()
    _check_user(user_id)
    return recommender.user_profile(user_id)


@app.get("/api/recommend/{user_id}")
def recommend(user_id: int, top_k: int = Query(5, ge=1, le=20)):
    _check_ready()
    _check_user(user_id)
    return recommender.recommend(user_id, top_k=top_k)


@app.get("/api/places")
def list_places(
    type: Optional[str] = Query(None, alias="type"),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    _check_ready()
    if type is not None and type not in PLACE_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {PLACE_TYPES}")
    items, total = recommender.list_places(
        place_type=type, min_rating=min_rating, search=search, limit=limit, offset=offset
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/api/places/{place_id}")
def place_detail(place_id: int):
    _check_ready()
    _check_place(place_id)
    place = recommender._place_row(place_id)
    place["similar_places"] = recommender.similar_places(place_id)
    return place


@app.get("/api/graph")
def graph(n: int = Query(60, ge=2, le=500)):
    _check_ready()
    return recommender.graph_subgraph(n_nodes=n)
