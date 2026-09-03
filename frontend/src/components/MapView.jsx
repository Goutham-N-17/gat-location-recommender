import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { PLACE_TYPE_COLORS } from "../api";

export default function MapView({ markers, center = [20, 78], zoom = 5 }) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <CircleMarker
          key={`${m.kind || "place"}-${m.id}`}
          center={[m.lat, m.lon]}
          radius={m.kind === "visited" ? 6 : 8}
          pathOptions={{
            color: PLACE_TYPE_COLORS[m.type] || "#38bdf8",
            fillColor: PLACE_TYPE_COLORS[m.type] || "#38bdf8",
            fillOpacity: m.kind === "visited" ? 0.35 : 0.85,
            weight: 2,
          }}
        >
          <Popup>
            <strong>#{m.id}</strong> · {m.type} <br />
            Rating: {m.rating} <br />
            {m.kind === "visited" ? "Visited" : "Recommended"}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
