import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { Loading, ErrorBanner, EmptyState } from "../components/Status";
import PlaceCard from "../components/PlaceCard";
import MapView from "../components/MapView";

export default function Recommendations() {
  const [userId, setUserId] = useState(2);
  const [topK, setTopK] = useState(5);

  const { data: users } = useAsync(() => api.users(), []);
  const {
    data: recs, loading: recsLoading, error: recsError,
  } = useAsync(() => api.recommend(userId, topK), [userId, topK]);
  const { data: visited, loading: visitedLoading } = useAsync(
    () => api.userVisited(userId), [userId]
  );
  const { data: profile } = useAsync(() => api.userProfile(userId), [userId]);

  const markers = [
    ...(visited || []).map((p) => ({ ...p, kind: "visited" })),
    ...(recs || []).map((p) => ({ ...p, kind: "recommended" })),
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Recommendations</h1>
        <p>Personalized picks from GAT embeddings + cosine similarity + type-frequency boost.</p>
      </div>

      <div className="toolbar">
        <label className="center-row" style={{ color: "var(--text-muted)", fontSize: 13 }}>
          User
          <select
            className="select"
            value={userId}
            onChange={(e) => setUserId(Number(e.target.value))}
            style={{ marginLeft: 8 }}
          >
            {(users || Array.from({ length: 200 }, (_, i) => ({ id: i }))).map((u) => (
              <option key={u.id} value={u.id}>
                User {u.id}
              </option>
            ))}
          </select>
        </label>

        <label className="center-row" style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Top K
          <select
            className="select"
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            style={{ marginLeft: 8 }}
          >
            {[3, 5, 8, 10].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>

        {profile && (
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Visited {profile.visited_count} places ·{" "}
            {profile.type_breakdown.map((t) => `${t.type} (${t.count})`).join(", ")}
          </span>
        )}
      </div>

      <ErrorBanner message={recsError} />

      <div className="recommend-row">
        <div className="card">
          <h3 className="section-title">Map</h3>
          {markers.length > 0 ? (
            <MapView markers={markers} />
          ) : (
            <EmptyState>No locations to show yet.</EmptyState>
          )}
          <div className="legend">
            <span><span className="legend-dot" style={{ background: "#38bdf8" }} /> recommended (solid)</span>
            <span><span className="legend-dot" style={{ background: "#38bdf8", opacity: 0.4 }} /> visited (hollow)</span>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Visited history</h3>
          {visitedLoading && <Loading label="Loading visited places…" />}
          {visited && (
            <div className="visited-list">
              {visited.map((p) => (
                <div className="visited-row" key={p.id}>
                  <span>#{p.id} · {p.type} · ★{p.rating}</span>
                  <span className="similarity-pill">sim {p.similarity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h3 className="section-title" style={{ marginTop: 24 }}>
        Recommended for User {userId}
      </h3>
      {recsLoading && <Loading label="Scoring places…" />}
      {recs && recs.length === 0 && <EmptyState>No recommendations found.</EmptyState>}
      {recs && recs.length > 0 && (
        <div className="place-list">
          {recs.map((p) => (
            <PlaceCard
              key={p.id}
              place={p}
              footer={<span className="similarity-pill">score {p.score}</span>}
            />
          ))}
        </div>
      )}
    </div>
  );
}
