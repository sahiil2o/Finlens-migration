import { AppState } from "./state.js";

/**
 * Fetches saved account metadata from local storage.
 */
export function getAccountMeta(accountId) {
  if (!accountId) return null;
  const key = `meta_${accountId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse account metadata from localStorage:", e);
    return null;
  }
}

/**
 * Persists and merges account metadata updates into local storage.
 */
export function saveAccountMeta(meta) {
  if (!meta || !meta.accountId) return;

  const key = `meta_${meta.accountId}`;
  const existingRaw = localStorage.getItem(key);

  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw);

      const parseDateStr = (dateStr) => {
        if (!dateStr) return new Date(0);
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          let [dd, mm, yyyy] = parts;
          if (yyyy.length === 2) yyyy = "20" + yyyy;
          return new Date(`${yyyy}-${mm}-${dd}`);
        }
        return new Date(dateStr);
      };

      const existingDate = parseDateStr(existing.stmtDate);
      const newDate = parseDateStr(meta.stmtDate);

      if (newDate >= existingDate) {
        existing.totalDue = meta.totalDue;
        existing.stmtDate = meta.stmtDate;
        existing.dueDate = meta.dueDate || existing.dueDate;
        existing.availableLimit = meta.availableLimit || existing.availableLimit;
      }

      existing.odLimit = meta.odLimit || existing.odLimit || 0;
      existing.creditLimit = meta.creditLimit || existing.creditLimit || 0;
      existing.cardLast4 = meta.cardLast4 || existing.cardLast4 || "";
      existing.accountType = meta.accountType || existing.accountType || "savings";
      
      localStorage.setItem(key, JSON.stringify(existing));
      AppState.meta = existing;
      return;
    } catch (e) {
      console.error("Failed to merge account metadata:", e);
    }
  }

  localStorage.setItem(key, JSON.stringify(meta));
  AppState.meta = meta;
}
