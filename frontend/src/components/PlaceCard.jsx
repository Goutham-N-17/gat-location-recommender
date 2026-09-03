import { PLACE_TYPE_COLORS } from "../api";

export default function PlaceCard({ place, onClick, footer }) {
  const color = PLACE_TYPE_COLORS[place.type] || "#94a3b8";
  return (
    <div className="card place-card" onClick={onClick}>
      <div className="place-card-top">
        <span
          className="badge"
          style={{ background: `${color}26`, color }}
        >
          {place.type}
        </span>
        <span className="rating">★ {place.rating?.toFixed?.(2) ?? place.rating}</span>
      </div>
      <div className="coords">
        #{place.id} · {place.lat.toFixed(2)}, {place.lon.toFixed(2)}
      </div>
      {place.reasons && (
        <ul className="reason-list">
          {place.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      {footer}
    </div>
  );
}
