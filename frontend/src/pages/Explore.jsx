import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { Loading, ErrorBanner, EmptyState } from "../components/Status";
import PlaceCard from "../components/PlaceCard";
import MapView from "../components/MapView";

const TYPES = ["waterfall", "temple", "beach", "monument", "hill", "lake"];
const PAGE_SIZE = 24;

export default function Explore() {
  const [type, setType] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  const { data, loading, error } = useAsync(
    () => api.places({ type: type || undefined, minRating: minRating || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [type, minRating, page]
  );

  const { data: detail, loading: detailLoading } = useAsync(
    () => (selectedId != null ? api.placeDetail(selectedId) : Promise.resolve(null)),
    [selectedId]
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function updateFilter(setter) {
    return (e) => {
      setter(e.target.value === "" ? "" : e.target.value);
      setPage(0);
    };
  }

  return (
    <div>
      <div className="page-header">
        <h1>Explore Places</h1>
        <p>Browse, search and filter the 5,000-place catalog used to build the graph.</p>
      </div>

      <div className="toolbar">
        <select className="select" value={type} onChange={updateFilter(setType)}>
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className="select"
          value={minRating}
          onChange={(e) => { setMinRating(Number(e.target.value)); setPage(0); }}
        >
          <option value={0}>Any rating</option>
          <option value={3.5}>3.5+</option>
          <option value={4}>4.0+</option>
          <option value={4.5}>4.5+</option>
        </select>

        {data && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{data.total.toLocaleString()} places match</span>}
      </div>

      <ErrorBanner message={error} />

      {selectedId != null && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <h3 className="section-title" style={{ margin: 0 }}>Place #{selectedId}</h3>
            <button className="btn btn-ghost" onClick={() => setSelectedId(null)}>Close</button>
          </div>
          {detailLoading && <Loading label="Loading place…" />}
          {detail && (
            <>
              <div className="tag-detail" style={{ marginBottom: 12 }}>
                <span>Type: {detail.type}</span>
                <span>Rating: ★ {detail.rating}</span>
                <span>Lat/Lon: {detail.lat.toFixed(3)}, {detail.lon.toFixed(3)}</span>
              </div>
              <MapView
                markers={[{ ...detail, kind: "recommended" }, ...detail.similar_places.map((p) => ({ ...p, kind: "visited" }))]}
                center={[detail.lat, detail.lon]}
                zoom={7}
              />
              <h3 className="section-title" style={{ marginTop: 16 }}>Nearby similar places</h3>
              <div className="place-list">
                {detail.similar_places.map((p) => (
                  <PlaceCard key={p.id} place={p} onClick={() => setSelectedId(p.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {loading && <Loading label="Loading places…" />}
      {data && data.items.length === 0 && <EmptyState>No places match these filters.</EmptyState>}
      {data && data.items.length > 0 && (
        <div className="place-list">
          {data.items.map((p) => (
            <PlaceCard key={p.id} place={p} onClick={() => setSelectedId(p.id)} />
          ))}
        </div>
      )}

      {data && (
        <div className="pagination">
          <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button className="btn btn-ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
