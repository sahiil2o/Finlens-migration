import express from "express";

import {
  getVendorsByAccount,
  getVendorByNormalizedName,
  updateVendorCategory,
  clearTransactionsAndVendors
} from "../database.js";

import { categorizeVendor, loadCache, saveCache } from "../ai.js";

const router = express.Router();

// ===============================
// GET ALL VENDORS
// ===============================
router.get("/vendors", async (req, res) => {
  try {
    const { accountId } = req.query;
    const rows = await getVendorsByAccount(accountId);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
});

// ===============================
// GET TOP VENDORS
// ===============================
router.get("/vendors/top", async (req, res) => {
  try {
    const { accountId } = req.query;
    const rows = await getVendorsByAccount(accountId, 10);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch top vendors" });
  }
});

// ===============================
// GET SINGLE VENDOR
// ===============================
router.get("/vendors/:name", async (req, res) => {
  try {
    const vendorName = req.params.name;
    const row = await getVendorByNormalizedName(vendorName);
    if (!row) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch vendor" });
  }
});

// ===============================
// AI CATEGORY ENDPOINT
// ===============================
router.post("/categorize", async (req, res) => {
  try {
    const { vendor } = req.body;

    if (!vendor) {
      return res.status(400).json({ error: "Vendor required" });
    }

    const category = await categorizeVendor(vendor);

    res.json({
      vendor,
      category
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI categorization failed" });
  }
});

// ===============================
// MANUAL VENDOR CATEGORIZATION OVERRIDE
// ===============================
router.post("/vendors/categorize", async (req, res) => {
  try {
    const { normalizedName, category } = req.body;
    if (!normalizedName || !category) {
      return res.status(400).json({ error: "normalizedName and category required" });
    }

    // 1. Update SQLite tables via repository helper
    await updateVendorCategory(normalizedName, category);

    // 2. Update vendor-cache.json file cache
    try {
      const cache = loadCache();
      cache[normalizedName] = category;
      saveCache(cache);
      console.log(`Manual override saved to cache: ${normalizedName} => ${category}`);
    } catch (cacheErr) {
      console.error("Failed to update vendor file cache:", cacheErr);
    }

    res.json({ success: true, message: `Vendor ${normalizedName} updated to ${category}` });
  } catch (error) {
    console.error("Manual categorization override failed:", error);
    res.status(500).json({ error: "Failed to override vendor category" });
  }
});

// ===============================
// CLEAR ALL CACHES & TABLES
// ===============================
router.post("/vendors/clear-cache", async (req, res) => {
  try {
    // 1. Clear tables via repository helper
    await clearTransactionsAndVendors();
    
    // 2. Reset file cache
    saveCache({});
    
    console.log("Database tables and local cache reset successfully.");
    res.json({ success: true, message: "Vendor cache and intelligence databases successfully reset." });
  } catch (error) {
    console.error("Failed to clear database cache:", error);
    res.status(500).json({ error: "Failed to reset cache databases" });
  }
});

export default router;
