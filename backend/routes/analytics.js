import express from "express";
import {
  getSubscriptionsHandler,
  getTrendsHandler
} from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/subscriptions", getSubscriptionsHandler);
router.get("/analytics/trends", getTrendsHandler);

export default router;
