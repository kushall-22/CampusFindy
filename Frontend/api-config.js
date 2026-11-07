(() => {
  const isLocalDevelopment =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const defaultApiBase = isLocalDevelopment
    ? "http://localhost:5000/api"
    : `${window.location.origin}/api`;

  window.CAMPUSFINDY_API_BASE = (
    window.CAMPUSFINDY_API_BASE || defaultApiBase
  ).replace(/\/+$/, "");
})();
