import { useEffect, useRef, useState } from "react";
import { DataSet } from "vis-data";
import { Network } from "vis-network";
import { api, PLACE_TYPE_COLORS } from "../api";
import { useAsync } from "../hooks/useAsync";
import { Loading, ErrorBanner } from "../components/Status";

export default function GraphView() {
  const [nodeCount, setNodeCount] = useState(60);
  const { data, loading, error } = useAsync(() => api.graph(nodeCount), [nodeCount]);
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    const nodes = new DataSet(
      data.nodes.map((n) => ({
        id: n.id,
        label: n.kind === "user" ? "" : n.type[0].toUpperCase(),
        title: n.kind === "user" ? `User ${n.id}` : `Place #${n.id} (${n.type})`,
        shape: n.kind === "user" ? "dot" : "diamond",
        size: n.kind === "user" ? 10 : 14,
        color: n.kind === "user" ? "#f87171" : (PLACE_TYPE_COLORS[n.type] || "#38bdf8"),
      }))
    );
    const edges = new DataSet(
      data.edges.map((e, i) => ({ id: i, from: e.source, to: e.target, color: { color: "#263352" } }))
    );

    networkRef.current?.destroy();
    networkRef.current = new Network(
      containerRef.current,
      { nodes, edges },
      {
        physics: { stabilization: true, barnesHut: { gravitationalConstant: -4000, springLength: 90 } },
        interaction: { hover: true, tooltipDelay: 100 },
        edges: { smooth: false, width: 1 },
      }
    );

    return () => networkRef.current?.destroy();
  }, [data]);

  return (
    <div>
      <div className="page-header">
        <h1>Graph View</h1>
        <p>Bipartite user-place graph plus place-place nearest-neighbor edges (red = user, colored diamond = place).</p>
      </div>

      <div className="toolbar">
        <div className="slider-row">
          Nodes: {nodeCount}
          <input
            type="range"
            min={20}
            max={300}
            step={10}
            value={nodeCount}
            onChange={(e) => setNodeCount(Number(e.target.value))}
          />
        </div>
      </div>

      <ErrorBanner message={error} />
      {loading && <Loading label="Building graph…" />}

      <div className="graph-canvas-wrap">
        <div ref={containerRef} style={{ height: 480, background: "#0b1220" }} />
      </div>

      <div className="legend">
        <span><span className="legend-dot" style={{ background: "#f87171" }} /> user</span>
        {Object.entries(PLACE_TYPE_COLORS).map(([type, color]) => (
          <span key={type}><span className="legend-dot" style={{ background: color }} /> {type}</span>
        ))}
      </div>
    </div>
  );
}
