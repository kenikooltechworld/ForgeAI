function SkeletonLoader() {
  const logoUri = (window as any).__FORGEAI_LOGO_URI__ || '';

  return (
    <div className="skeleton-loader">
      <div className="skeleton-role-label">ForgeAI</div>

      <div className="skeleton-card">
        <div className="skeleton-header">
          {logoUri ? <img src={logoUri} alt="Kenikool Logo" className="skeleton-logo" /> : null}
          <span className="skeleton-status-text">Thinking...</span>
        </div>

        <div className="skeleton-lines">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      </div>
    </div>
  );
}

export default SkeletonLoader;
