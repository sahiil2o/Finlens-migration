import express from "express";
import {
  getVendorsHandler,
  getTopVendorsHandler,
  getSingleVendorHandler,
  categorizeVendorHandler,
  overrideVendorCategoryHandler,
  clearCacheHandler
} from "../controllers/vendorsController.js";

const router = express.Router();

router.get("/vendors", getVendorsHandler);
router.get("/vendors/top", getTopVendorsHandler);
router.get("/vendors/:name", getSingleVendorHandler);
router.post("/categorize", categorizeVendorHandler);
router.post("/vendors/categorize", overrideVendorCategoryHandler);
router.post("/vendors/clear-cache", clearCacheHandler);

export default router;
