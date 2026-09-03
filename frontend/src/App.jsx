import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Recommendations from "./pages/Recommendations.jsx";
import Explore from "./pages/Explore.jsx";
import GraphView from "./pages/GraphView.jsx";

const links = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/recommend", label: "Recommendations", icon: "🧭" },
  { to: "/explore", label: "Explore Places", icon: "🗺️" },
  { to: "/graph", label: "Graph View", icon: "🕸️" },
];

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          GAT Recommender
          <span>Location Graph AI</span>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            <span>{l.icon}</span> {l.label}
          </NavLink>
        ))}
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recommend" element={<Recommendations />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/graph" element={<GraphView />} />
        </Routes>
      </main>
    </div>
  );
}
