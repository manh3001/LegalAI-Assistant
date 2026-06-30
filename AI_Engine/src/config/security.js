const rateLimit = require('express-rate-limit');

// Origins allowed to call the API from a browser. Override with the
// CORS_ORIGINS env var (comma-separated) in production if the domain changes.
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://legal-ai-assistant-manh301.vercel.app',
];

function allowedList() {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

// Allow: non-browser callers (no Origin header), the explicit allowlist,
// localhost, and any *.vercel.app (covers preview/redeploy URLs).
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedList().includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host.endsWith('.vercel.app')) return true;
  } catch (_) {
    /* malformed Origin header */
  }
  return false;
}

const corsOptions = {
  origin(origin, cb) {
    return isAllowedOrigin(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Cap calls to the (unauthenticated) AI endpoints so a public URL cannot be
// used to burn the project's Gemini/Pinecone quota. ~6 req/min/IP is ample
// for real use but bounds abuse.
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều yêu cầu AI. Vui lòng thử lại sau ít phút.' },
});

// Slow brute-force on login/register.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều lần thử. Vui lòng thử lại sau.' },
});

module.exports = { isAllowedOrigin, corsOptions, aiLimiter, authLimiter, DEFAULT_ORIGINS };
