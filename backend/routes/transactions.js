import express from "express";
import {
  getTransactionsHandler,
  saveTransactionsHandler,
  saveMetadataHandler,
  getMetadataHandler,
  parseXlsHandler
} from "../controllers/transactionsController.js";

const router = express.Router();

router.get("/transactions", getTransactionsHandler);
router.post("/transactions", saveTransactionsHandler);
router.post("/metadata", saveMetadataHandler);
router.get("/metadata", getMetadataHandler);
router.post("/parse-xls", parseXlsHandler);

export default router;
