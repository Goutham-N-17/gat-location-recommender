const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore non-json error bodies
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  health: () => request("/api/health"),
  stats: () => request("/api/stats"),
  users: () => request("/api/users"),
  userVisited: (userId) => request(`/api/users/${userId}/visited`),
  userProfile: (userId) => request(`/api/users/${userId}/profile`),
  recommend: (userId, topK = 5) => request(`/api/recommend/${userId}?top_k=${topK}`),
  places: ({ type, minRating, search, limit = 24, offset = 0 } = {}) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (minRating) params.set("min_rating", minRating);
    if (search) params.set("search", search);
    params.set("limit", limit);
    params.set("offset", offset);
    return request(`/api/places?${params.toString()}`);
  },
  placeDetail: (placeId) => request(`/api/places/${placeId}`),
  graph: (n = 60) => request(`/api/graph?n=${n}`),
};

export const PLACE_TYPE_COLORS = {
  waterfall: "#0ea5e9",
  temple: "#f59e0b",
  beach: "#f97316",
  monument: "#8b5cf6",
  hill: "#22c55e",
  lake: "#06b6d4",
};
