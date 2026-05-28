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
// MIDDLEWARE
// ===============================
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));

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
// MOUNT MODULAR ROUTERS (STEP 3)
// ===============================
app.use(transactionsRouter);
app.use(vendorsRouter);
app.use(analyticsRouter);

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`FinLens AI server running on http://localhost:${PORT}`);
});