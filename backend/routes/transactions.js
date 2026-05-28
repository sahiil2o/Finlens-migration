import express from "express";
import {
  getTransactionsHandler,
  saveTransactionsHandler,
  saveMetadataHandler,
  getMetadataHandler,
  parseXlsHandler,
  linkTransactionsHandler
} from "../controllers/transactionsController.js";
import { getQueueStatus, resetCircuitBreaker } from "../aiQueue.js";

const router = express.Router();

router.get("/transactions", getTransactionsHandler);
router.post("/transactions", saveTransactionsHandler);
router.post("/metadata", saveMetadataHandler);
router.get("/metadata", getMetadataHandler);
router.post("/parse-xls", parseXlsHandler);
router.post("/transactions/link", linkTransactionsHandler);

router.get("/ai/status", (req, res) => {
  res.json(getQueueStatus());
});

router.post("/ai/status/reset", (req, res) => {
  resetCircuitBreaker();
  res.json({ success: true, status: getQueueStatus() });
});

export default router;
