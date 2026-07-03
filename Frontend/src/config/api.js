// Central API + Socket base URLs.
// In production, set VITE_API_BASE_URL (e.g. https://your-host/api).
// Falls back to local dev when the env var is not set.
export const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Socket.IO connects to the server root (without the /api suffix).
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');
