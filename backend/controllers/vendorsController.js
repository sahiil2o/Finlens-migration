// ==========================================
// VENDORS CONTROLLER HANDLERS
// ==========================================

import {
  getVendorsByAccount,
  getVendorByNormalizedName,
  updateVendorCategory,
  clearTransactionsAndVendors
} from "../db/index.js";

import { categorizeVendor, loadCache, saveCache, VALID_CATEGORIES } from "../ai.js";

/**
 * GET /vendors
 * Retrieves categorized transaction aggregates grouped by vendor merchant name.
 */
export async function getVendorsHandler(req, res, next) {
  try {
    const { accountId } = req.query;
    if (accountId !== undefined && typeof accountId !== "string") {
      const err = new Error("accountId query parameter must be a string");
      err.status = 400;
      return next(err);
    }
    const rows = await getVendorsByAccount(accountId);
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /vendors/top
 * Retrieves the top 10 merchants sorted by total spends.
 */
export async function getTopVendorsHandler(req, res, next) {
  try {
    const { accountId } = req.query;
    if (accountId !== undefined && typeof accountId !== "string") {
      const err = new Error("accountId query parameter must be a string");
      err.status = 400;
      return next(err);
    }
    const rows = await getVendorsByAccount(accountId, 10);
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /vendors/:name
 * Retrieves the profile database record of a single vendor.
 */
export async function getSingleVendorHandler(req, res, next) {
  try {
    const vendorName = req.params.name;
    if (!vendorName || typeof vendorName !== "string") {
      const err = new Error("Vendor name parameter is required and must be a string");
      err.status = 400;
      return next(err);
    }
    const row = await getVendorByNormalizedName(vendorName);
    if (!row) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.json(row);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /categorize
 * Processes vendor names via local AI model for automatic categorization checks.
 */
export async function categorizeVendorHandler(req, res, next) {
  try {
    const { vendor } = req.body;

    if (!vendor || typeof vendor !== "string" || !vendor.trim()) {
      const err = new Error("Vendor description string is required");
      err.status = 400;
      return next(err);
    }

    const category = await categorizeVendor(vendor);

    res.json({
      vendor,
      category
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /vendors/categorize
 * Registers manual user category overrides, updating both SQL tables and local intelligence cache files.
 */
export async function overrideVendorCategoryHandler(req, res, next) {
  try {
    const { normalizedName, category } = req.body;
    if (!normalizedName || typeof normalizedName !== "string" || !normalizedName.trim()) {
      const err = new Error("normalizedName string is required");
      err.status = 400;
      return next(err);
    }
    if (!category || typeof category !== "string" || !category.trim()) {
      const err = new Error("category string is required");
      err.status = 400;
      return next(err);
    }

    // Validate category against system defined valid options
    if (!VALID_CATEGORIES.includes(category.toLowerCase())) {
      const err = new Error(`Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(", ")}`);
      err.status = 400;
      return next(err);
    }

    const cleanCategory = category.toLowerCase();

    // 1. Update SQLite tables via repository helper
    await updateVendorCategory(normalizedName, cleanCategory);

    // 2. Update vendor-cache.json file cache
    try {
      const cache = await loadCache();
      cache[normalizedName] = cleanCategory;
      await saveCache(cache);
      console.log(`[VendorsController] Manual override saved to cache: ${normalizedName} => ${cleanCategory}`);
    } catch (cacheErr) {
      console.error("[VendorsController] vendor cache file write failed:", cacheErr);
    }

    res.json({ success: true, message: `Vendor ${normalizedName} updated to ${cleanCategory}` });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /vendors/clear-cache
 * Resets SQLite statements, vendor profiles, and AI file caches.
 */
export async function clearCacheHandler(req, res, next) {
  try {
    // 1. Clear tables via repository helper
    await clearTransactionsAndVendors();
    
    // 2. Reset file cache
    await saveCache({});
    
    console.log("[VendorsController] Database tables and local cache reset successfully.");
    res.json({ success: true, message: "Vendor cache and intelligence databases successfully reset." });
  } catch (error) {
    next(error);
  }
}
