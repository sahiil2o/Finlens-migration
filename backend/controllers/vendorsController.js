// ==========================================
// VENDORS CONTROLLER HANDLERS
// ==========================================

import {
  getVendorsByAccount,
  getVendorByNormalizedName,
  updateVendorCategory,
  clearTransactionsAndVendors
} from "../db/index.js";

import { categorizeVendor, loadCache, saveCache } from "../ai.js";

/**
 * GET /vendors
 * Retrieves categorized transaction aggregates grouped by vendor merchant name.
 */
export async function getVendorsHandler(req, res) {
  try {
    const { accountId } = req.query;
    const rows = await getVendorsByAccount(accountId);
    res.json(rows);
  } catch (error) {
    console.error("[VendorsController] getVendors failed:", error);
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
}

/**
 * GET /vendors/top
 * Retrieves the top 10 merchants sorted by total spends.
 */
export async function getTopVendorsHandler(req, res) {
  try {
    const { accountId } = req.query;
    const rows = await getVendorsByAccount(accountId, 10);
    res.json(rows);
  } catch (error) {
    console.error("[VendorsController] getTopVendors failed:", error);
    res.status(500).json({ error: "Failed to fetch top vendors" });
  }
}

/**
 * GET /vendors/:name
 * Retrieves the profile database record of a single vendor.
 */
export async function getSingleVendorHandler(req, res) {
  try {
    const vendorName = req.params.name;
    const row = await getVendorByNormalizedName(vendorName);
    if (!row) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(row);
  } catch (error) {
    console.error("[VendorsController] getSingleVendor failed:", error);
    res.status(500).json({ error: "Failed to fetch vendor" });
  }
}

/**
 * POST /categorize
 * Processes vendor names via local AI model for automatic categorization checks.
 */
export async function categorizeVendorHandler(req, res) {
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
    console.error("[VendorsController] AI categorize failed:", error);
    res.status(500).json({ error: "AI categorization failed" });
  }
}

/**
 * POST /vendors/categorize
 * Registers manual user category overrides, updating both SQL tables and local intelligence cache files.
 */
export async function overrideVendorCategoryHandler(req, res) {
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
      console.error("[VendorsController] vendor cache file write failed:", cacheErr);
    }

    res.json({ success: true, message: `Vendor ${normalizedName} updated to ${category}` });
  } catch (error) {
    console.error("[VendorsController] overrideVendorCategory failed:", error);
    res.status(500).json({ error: "Failed to override vendor category" });
  }
}

/**
 * POST /vendors/clear-cache
 * Resets SQLite statements, vendor profiles, and AI file caches.
 */
export async function clearCacheHandler(req, res) {
  try {
    // 1. Clear tables via repository helper
    await clearTransactionsAndVendors();
    
    // 2. Reset file cache
    saveCache({});
    
    console.log("Database tables and local cache reset successfully.");
    res.json({ success: true, message: "Vendor cache and intelligence databases successfully reset." });
  } catch (error) {
    console.error("[VendorsController] clearCache failed:", error);
    res.status(500).json({ error: "Failed to reset cache databases" });
  }
}
