// ==========================================
// PURE TRANSACTION FILTERING ENGINE
// ==========================================

/**
 * Pure function that filters and sorts an array of transactions based on user inputs.
 * Has no side-effects and is completely testable.
 * 
 * @param {Array} transactions - Stored transactions
 * @param {Object} criteria - Filter inputs (search, category, type, month, accountId, sortBy)
 * @returns {Array} Filtered and sorted transactions list
 */
export function applyFiltersEngine(transactions, criteria) {
  const { search, category, type, month, accountId, sortBy } = criteria;

  let filtered = [...transactions];

  // 1. MONTH / DATE SLICER FILTER
  if (month && month !== "all") {
    if (month.startsWith("stmt:")) {
      const targetStmt = month.replace("stmt:", "");
      filtered = filtered.filter(t => t.statementDate === targetStmt);
    } else if (month.startsWith("month:")) {
      const targetMonth = month.replace("month:", "");
      filtered = filtered.filter(t => {
        if (!t.date) return false;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return false;
        const year = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${m}` === targetMonth;
      });
    } else if (month.startsWith("cycle:")) {
      const [startStr, endStr] = month.replace("cycle:", "").split("_");
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      filtered = filtered.filter(t => {
        if (!t.date) return false;
        const tDate = new Date(t.date);
        if (isNaN(tDate.getTime())) return false;
        return tDate >= startDate && tDate < endDate;
      });
    }
  }

  // 2. ACCOUNT / CARD FILTER
  if (accountId && accountId !== "all") {
    if (accountId === "HDFC Credit Card") {
      filtered = filtered.filter(t => t.sourceBank && t.sourceBank.includes("CC"));
    } else {
      filtered = filtered.filter(t => t.sourceBank === accountId);
    }
  }

  // 3. SEARCH FILTER
  if (search) {
    const searchLower = search.toLowerCase().trim();
    filtered = filtered.filter(transaction => {
      const description = transaction.description || "";
      const sourceBank = transaction.sourceBank || "";
      return description.toLowerCase().includes(searchLower) || sourceBank.toLowerCase().includes(searchLower);
    });
  }

  // 4. CATEGORY FILTER
  if (category) {
    filtered = filtered.filter(transaction => transaction.category === category);
  }

  // 5. TYPE FILTER
  if (type) {
    filtered = filtered.filter(transaction => transaction.type === type);
  }

  // 6. SORT TRANSACTIONS
  if (sortBy === "date-asc") {
    filtered.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return da - db;
    });
  } else if (sortBy === "date-desc") {
    filtered.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });
  } else if (sortBy === "amount-desc") {
    filtered.sort((a, b) => Number(b.amount) - Number(a.amount));
  } else if (sortBy === "amount-asc") {
    filtered.sort((a, b) => Number(a.amount) - Number(b.amount));
  } else if (sortBy === "desc-asc") {
    filtered.sort((a, b) => (a.description || "").localeCompare(b.description || ""));
  } else if (sortBy === "desc-desc") {
    filtered.sort((a, b) => (b.description || "").localeCompare(a.description || ""));
  } else if (sortBy === "cat-asc") {
    filtered.sort((a, b) => (a.category || "other").localeCompare(b.category || "other"));
  } else if (sortBy === "cat-desc") {
    filtered.sort((a, b) => (b.category || "other").localeCompare(a.category || "other"));
  }

  return filtered;
}
