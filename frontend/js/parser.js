// ===============================
// HDFC CREDIT CARD CSV PARSER
// ===============================

function cleanAmount(value) {

  if (!value) return 0;

  return parseFloat(
    value.replace(/,/g, "").trim()
  ) || 0;
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

// ===============================
// NORMALIZE TRANSACTION
// ===============================

function normalizeTransaction(txn, meta) {

  return {

    id: crypto.randomUUID(),

    // Dates
    date: txn.dateObj,
    dateString: txn.dateStr,

    // Core transaction data
    description: txn.desc,
    amount: txn.amt,

    // Transaction type
    type: txn.isCr ? "credit" : "debit",

    // Categorization
    category: null,

    // Merchant info
    merchant: txn.desc,
    normalizedMerchant: txn.desc.toLowerCase(),

    // Metadata
    sourceBank: "HDFC",
    statementDate: meta.stmtDate || null,

    // Future features
    recurring: false,
    aiCategorized: false
  };
}

// ===============================
// MAIN PARSER
// ===============================

export function parseHDFC(text) {

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const meta = {};

  // ===============================
  // EXTRACT METADATA
  // ===============================

  for (const line of lines) {

    const parts = line
      .split("~|~")
      .map(p => p.trim());

    if (parts[0] === "Payment Due Date") {
      meta.dueDate = parts[1];
    }

    if (parts[0] === "Statement Date") {
      meta.stmtDate = parts[1];
    }

    if (parts[0] === "Total Amount Due") {
      meta.totalDue = cleanAmount(parts[1]);
    }

    if (parts[0] === "Minimum Amount Due") {
      meta.minDue = cleanAmount(parts[1]);
    }

    if (parts[0] === "Credit Limit") {
      meta.creditLimit = cleanAmount(parts[1]);
    }

    if (parts[0] === "Available Limit") {
      meta.availableLimit = cleanAmount(parts[1]);
    }

    if (line.includes("Card No:")) {

      const match = line.match(
        /Card No:\s*([\dX ]+)/i
      );

      if (match) {

        meta.cardLast4 = match[1]
          .trim()
          .slice(-4);
      }
    }
  }

  // ===============================
  // FIND TRANSACTION TABLE
  // ===============================

  const txnHeaderIndex = lines.findIndex(line =>

    line.includes("Transaction type") &&
    line.includes("DATE") &&
    line.includes("Description")
  );

  const transactions = [];

  // ===============================
  // PARSE TRANSACTIONS
  // ===============================

  if (txnHeaderIndex >= 0) {

    for (
      let i = txnHeaderIndex + 1;
      i < lines.length;
      i++
    ) {

      const line = lines[i];

      if (
        !line.startsWith("Domestic") &&
        !line.startsWith("International")
      ) {
        continue;
      }

      const parts = line.split("~|~");

      if (parts.length < 6) continue;

      const typeMarker = (
        parts[5] || ""
      ).trim().toLowerCase();

      const isCredit =
        typeMarker === "cr";

      const amount =
        cleanAmount(parts[4]);

      if (!amount) continue;

      const transaction = {

        dateStr: (
          parts[2] || ""
        ).trim(),

        dateObj: parseDate(
          parts[2] || ""
        ),

        desc: (
          parts[3] || ""
        ).trim(),

        amt: amount,

        isCr: isCredit
      };

      transactions.push(
        normalizeTransaction(
          transaction,
          meta
        )
      );
    }
  }

  // ===============================
  // SORT NEWEST FIRST
  // ===============================

  transactions.sort((a, b) => {

    if (!a.date || !b.date) {
      return 0;
    }

    return b.date - a.date;
  });

  return {
    meta,
    transactions
  };
}