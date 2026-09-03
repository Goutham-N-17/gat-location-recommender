import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from "recharts";
import { api, PLACE_TYPE_COLORS } from "../api";
import { useAsync } from "../hooks/useAsync";
import { Loading, ErrorBanner } from "../components/Status";

export default function Dashboard() {
  const { data: stats, loading, error } = useAsync(() => api.stats(), []);

  return (
    <div>
      <div className="page-header">
        <h1>Overview</h1>
        <p>Synthetic user-place graph, trained with a 2-layer Graph Attention Network.</p>
      </div>

      <ErrorBanner message={error} />
      {loading && <Loading label="Loading stats…" />}

      {stats && (
        <>
          <div className="grid grid-stats">
            <StatCard label="Places" value={stats.num_places.toLocaleString()} />
            <StatCard label="Users" value={stats.num_users.toLocaleString()} />
            <StatCard label="Interactions" value={stats.num_interactions.toLocaleString()} />
            <StatCard label="Avg Rating" value={stats.avg_rating.toFixed(2)} />
            <StatCard label="Embedding Dim" value={stats.embedding_dim} />
          </div>

          <div className="charts-row">
            <div className="card">
              <h3 className="section-title">Place Types</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.type_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#263352" />
                  <XAxis dataKey="type" stroke="#93a0bd" fontSize={12} />
                  <YAxis stroke="#93a0bd" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "#16213a", border: "1px solid #263352", borderRadius: 8 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.type_distribution.map((entry) => (
                      <Cell key={entry.type} fill={PLACE_TYPE_COLORS[entry.type] || "#38bdf8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="legend">
                {stats.type_distribution.map((t) => (
                  <span key={t.type}>
                    <span
                      className="legend-dot"
                      style={{ background: PLACE_TYPE_COLORS[t.type] || "#94a3b8" }}
                    />
                    {t.type}: {t.count}
                  </span>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="section-title">GAT Training Loss (30 epochs)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.loss_history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#263352" />
                  <XAxis dataKey="epoch" stroke="#93a0bd" fontSize={12} />
                  <YAxis stroke="#93a0bd" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "#16213a", border: "1px solid #263352", borderRadius: 8 }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="loss" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card stat-card">
      <span className="value">{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}
