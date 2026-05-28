import express from "express";
import cors from "cors";

import { initializeDatabase } from "./db/index.js";
import { PORT } from "./config.js";

import transactionsRouter from "./routes/transactions.js";
import vendorsRouter from "./routes/vendors.js";
import analyticsRouter from "./routes/analytics.js";

const app = express();

// Initialize SQLite tables & schema on startup
initializeDatabase();

// ===============================
// MIDDLEWARE - HIGH RESILIENCE CORS
// ===============================
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if the origin matches localhost or 127.0.0.1 (with optional port numbers)
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (isLocalhost) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: Origin "${origin}" is not authorized.`));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));

// ===============================
// STRUCTURED LOGGER MIDDLEWARE
// ===============================
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLevel = res.statusCode >= 400 ? "WARN" : "INFO";
    console.log(`[${logLevel}] ${timestamp}: ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ===============================
// HEALTH CHECK
// ===============================
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "FinLens Local AI"
  });
});

// ===============================
// MOUNT MODULAR ROUTERS
// ===============================
app.use(transactionsRouter);
app.use(vendorsRouter);
app.use(analyticsRouter);

// ===============================
// CENTRALIZED GLOBAL ERROR HANDLER
// ===============================
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const statusCode = err.status || err.statusCode || 500;
  
  if (statusCode >= 500) {
    console.error(`[ERROR] ${timestamp}: Server side exception:`, err);
  } else {
    console.warn(`[WARN] ${timestamp}: Client side error: ${err.message}`);
  }
  
  res.status(statusCode).json({
    error: {
      message: err.message || "Internal Server Error",
      status: statusCode
    }
  });
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`FinLens AI server running on http://localhost:${PORT}`);
});