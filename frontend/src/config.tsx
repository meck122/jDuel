function getWebSocketUrl(): string {
  // Development: connect to backend on port 8000
  if (window.location.hostname === 'localhost') {
    return 'ws://localhost:8000/ws';
  }

  // Production: match page protocol (ws:// or wss://)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function getApiUrl(): string {
  // Development: connect to backend on port 8000
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:8000/api';
  }

  // Production: match page protocol and host
  return `${window.location.protocol}//${window.location.host}/api`;
}

export const WS_URL = getWebSocketUrl();
export const API_URL = getApiUrl();
