// Auto-detect protocol: use wss:// for https://, ws:// for http://
function getWebSocketUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // Development default
  if (window.location.hostname === 'localhost') {
    return 'ws://localhost:8000/ws';
  }

  // Production: match page protocol
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Development default
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:8000/api';
  }

  // Production: match page protocol
  return `${window.location.protocol}//${window.location.host}/api`;
}

const WS_URL = getWebSocketUrl();
const API_URL = getApiUrl();

export { WS_URL, API_URL };
