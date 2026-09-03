export function Loading({ label = "Loading…" }) {
  return (
    <div className="center-row">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="error-banner">⚠ {message}</div>;
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}
