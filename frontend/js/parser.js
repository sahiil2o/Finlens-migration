// ==========================================
// HDFC STATEMENT PARSER (CREDIT & SAVINGS)
// ==========================================

import { saveAccountMeta } from "./metaStore.js";

function cleanAmount(value) {
  if (!value) return 0;
  return parseFloat(value.replace(/,/g, "").trim()) || 0;
}

function parseDate(dateStr) {
  try {
    const dateOnly = dateStr.split(" ")[0];
    const [dd, mm, yyyy] = dateOnly.split("/");
    return new Date(`${yyyy}-${mm}-${dd}`);
  } catch {
    return null;
  }
}

function parseSavingsDate(dateStr) {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split("/");
    if (parts.length < 3) return null;
    let [dd, mm, yyyy] = parts;
    if (yyyy.length === 2) yyyy = "20" + yyyy;
    return new Date(`${yyyy}-${mm}-${dd}`);
  } catch {
    return null;
  }
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ==========================================
// DETECT TYPE AND PARSE HDFC STATEMENTS
// ==========================================

export function parseHDFC(text) {
  if (text.includes("~|~")) {
    return parseHdfcCreditCard(text);
  } else {
    return parseHdfcSavingsAccount(text);
  }
}

// ==========================================
// HDFC CREDIT CARD PARSER
// ==========================================

function parseHdfcCreditCard(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const meta = {
    accountType: "credit"
  };

  for (const line of lines) {
    const parts = line.split("~|~").map(p => p.trim());

    if (parts[0] === "Payment Due Date") meta.dueDate = parts[1];
    if (parts[0] === "Statement Date") meta.stmtDate = parts[1];
    if (parts[0] === "Total Amount Due") meta.totalDue = cleanAmount(parts[1]);
    if (parts[0] === "Minimum Amount Due") meta.minDue = cleanAmount(parts[1]);
    if (parts[0] === "Credit Limit") meta.creditLimit = cleanAmount(parts[1]);
    if (parts[0] === "Available Limit") meta.availableLimit = cleanAmount(parts[1]);

    if (line.includes("Card No:")) {
      const match = line.match(/Card No:\s*([\dX ]+)/i);
      if (match) {
        meta.cardLast4 = match[1].trim().slice(-4);
      }
    }
  }

  const accountId = meta.cardLast4 ? `HDFC CC ${meta.cardLast4}` : "HDFC Credit";
  meta.accountId = accountId;

  // Persist metadata locally for multi-card limit layouts
  saveAccountMeta(meta);

  const txnHeaderIndex = lines.findIndex(line =>
    line.includes("Transaction type") &&
    line.includes("DATE") &&
    line.includes("Description")
  );

  const transactions = [];

  if (txnHeaderIndex >= 0) {
    for (let i = txnHeaderIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      if (!line.startsWith("Domestic") && !line.startsWith("International")) {
        continue;
      }

      const parts = line.split("~|~");
      if (parts.length < 6) continue;

      const typeMarker = (parts[5] || "").trim().toLowerCase();
      const isCredit = typeMarker === "cr";
      const amount = cleanAmount(parts[4]);

      if (!amount) continue;

      transactions.push({
        id: crypto.randomUUID(),
        date: parseDate(parts[2] || ""),
        dateString: (parts[2] || "").trim(),
        description: (parts[3] || "").trim(),
        amount,
        type: isCredit ? "credit" : "debit",
        category: null,
        merchant: (parts[3] || "").trim(),
        normalizedMerchant: (parts[3] || "").trim().toLowerCase(),
        sourceBank: accountId,
        statementDate: meta.stmtDate || null,
        recurring: false,
        aiCategorized: false
      });
    }
  }

  transactions.sort((a, b) => (b.date || 0) - (a.date || 0));

  return { meta, transactions };
}

// ==========================================
// HDFC SAVINGS ACCOUNT PARSER
// ==========================================

function parseHdfcSavingsAccount(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  let accountLast4 = "Savings";
  
  for (const line of lines) {
    const acctMatch = line.match(/(?:Account No|A\/C No|Account)\s*:?\s*(\d+)/i) || 
                      line.match(/(?:Account No|A\/C No|Account)\s+[\dX\s]*(\d{4})/i);
    if (acctMatch) {
      accountLast4 = acctMatch[1].trim().slice(-4);
      break;
    }
  }

  const accountId = `HDFC Savings ${accountLast4}`;
  const meta = {
    accountId,
    accountType: "savings",
    stmtDate: new Date().toLocaleDateString("en-GB")
  };

  // Savings accounts don't have statement dues or limits
  saveAccountMeta(meta);

  // Find standard HDFC savings transactions header
  const headerIdx = lines.findIndex(line => {
    const low = line.toLowerCase();
    return (low.includes("narration") || low.includes("description")) &&
           (low.includes("withdrawal") || low.includes("debit") || low.includes("deposit") || low.includes("credit"));
  });

  const transactions = [];

  if (headerIdx >= 0) {
    const headerParts = splitCsvLine(lines[headerIdx]).map(p => p.toLowerCase());
    
    const dateIdx = headerParts.findIndex(p => p.includes("date"));
    const descIdx = headerParts.findIndex(p => p.includes("narration") || p.includes("desc"));
    const chqIdx = headerParts.findIndex(p => p.includes("chq") || p.includes("ref"));
    const withdrawalIdx = headerParts.findIndex(p => p.includes("withdrawal") || p.includes("debit") || p.includes("withdraw"));
    const depositIdx = headerParts.findIndex(p => p.includes("deposit") || p.includes("credit"));

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = splitCsvLine(line);
      
      if (parts.length <= Math.max(dateIdx, descIdx)) continue;

      const dateStr = parts[dateIdx] || "";
      const dateObj = parseSavingsDate(dateStr);
      if (!dateObj || isNaN(dateObj.getTime())) continue;

      const desc = parts[descIdx] || "Savings transaction";
      const withdrawal = withdrawalIdx >= 0 ? cleanAmount(parts[withdrawalIdx]) : 0;
      const deposit = depositIdx >= 0 ? cleanAmount(parts[depositIdx]) : 0;

      if (!withdrawal && !deposit) continue;

      const isCredit = deposit > 0;
      const amount = isCredit ? deposit : withdrawal;

      transactions.push({
        id: crypto.randomUUID(),
        date: dateObj,
        dateString: dateStr,
        description: desc,
        amount,
        type: isCredit ? "credit" : "debit",
        category: null,
        merchant: desc,
        normalizedMerchant: desc.toLowerCase(),
        sourceBank: accountId,
        statementDate: null,
        recurring: false,
        aiCategorized: false
      });
    }
  }

  transactions.sort((a, b) => (b.date || 0) - (a.date || 0));

  return { meta, transactions };
}