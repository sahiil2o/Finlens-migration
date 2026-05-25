// ===============================
// CATEGORY DEFINITIONS
// ===============================
import { AppState } from "./state.js";

export const CATEGORIES = {

  food: {
    label: "Food & Dining",
    color: "#ff6b4a",
    keywords: [
      "swiggy",
      "zomato",
      "restaurant",
      "eatclub",
      "pizza",
      "cafe",
      "coffee"
    ]
  },

  grocery: {
    label: "Grocery",
    color: "#f5a623",
    keywords: [
      "zepto",
      "blinkit",
      "bigbasket",
      "instamart",
      "grofers"
    ]
  },

  shopping: {
    label: "Shopping",
    color: "#5e6bff",
    keywords: [
      "amazon",
      "flipkart",
      "myntra",
      "ajio",
      "nykaa"
    ]
  },

  bills: {
    label: "Bills & Recharge",
    color: "#a78bfa",
    keywords: [
      "airtel",
      "jio",
      "vi ",
      "bsnl",
      "netflix",
      "spotify",
      "insurance"
    ]
  },

  fuel: {
    label: "Fuel",
    color: "#3de89b",
    keywords: [
      "petrol",
      "fuel",
      "hpcl",
      "bpcl",
      "iocl"
    ]
  },

  entertainment: {
    label: "Entertainment",
    color: "#f472b6",
    keywords: [
      "bookmyshow",
      "pvr",
      "inox",
      "hotstar"
    ]
  },

  payment: {
    label: "Payment / Credit",
    color: "#94a3b8",
    keywords: [
      "payment",
      "autopay",
      "refund",
      "cashback"
    ]
  },

  other: {
    label: "Other",
    color: "#475569",
    keywords: []
  }
};

// ===============================
// VENDOR NORMALIZATION
// ===============================

export function normalizeVendor(description) {

  return description
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\b(india|pvt|ltd|services|private|limited)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ===============================
// RULE-BASED CATEGORY MATCHING
// ===============================

export function detectCategory(description) {

  const normalized = normalizeVendor(description);

  for (const [key, category] of Object.entries(CATEGORIES)) {

    if (key === "other") continue;

    const matched = category.keywords.some(keyword =>
      normalized.includes(keyword)
    );

    if (matched) {
      return key;
    }
  }

  return "other";
}

// ===============================
// LOCAL AI CATEGORY REQUEST
// ===============================

async function getAICategory(
  vendor
) {

  try {

    // ===============================
    // CACHE CHECK
    // ===============================

    if (
      AppState.vendorCache[vendor]
    ) {

      return AppState
        .vendorCache[vendor];
    }

    // ===============================
    // LOCAL BACKEND REQUEST
    // ===============================

    const response = await fetch(
      "http://localhost:3000/categorize",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          vendor
        })
      }
    );

    const data =
      await response.json();

    const category =
      data.category || "other";

    // ===============================
    // CACHE RESULT
    // ===============================

    AppState.vendorCache[vendor]
      = category;

    return category;

  } catch (error) {

    console.error(
      "Local AI categorization failed:",
      error
    );

    return "other";
  }
}


// ===============================
// TRANSACTION CATEGORIZATION
// ===============================

export function categorizeTransactions(
  transactions
) {

  const categorized = [];

  for (const transaction of transactions) {

    // ===============================
    // CREDIT TRANSACTIONS
    // ===============================

    if (
      transaction.type === "credit"
    ) {

      categorized.push({
        ...transaction,
        category: "payment"
      });

      continue;
    }

    // ===============================
    // RULE MATCH
    // ===============================

    let category =
      detectCategory(
        transaction.description
      );

    // ===============================
    // IMMEDIATE RETURN
    // ===============================

    const enrichedTransaction = {

      ...transaction,

      category,

      aiCategorized: false
    };

      categorized.push(
        enrichedTransaction
      );

      // ===============================
      // BACKGROUND AI ENRICHMENT
      // ===============================

//       if (category === "other") {

//   setTimeout(async () => {

//     try {

//       const aiCategory =
//         await getAICategory(
//           transaction.description
//         );

//       enrichedTransaction.category =
//         aiCategory;

//       enrichedTransaction.aiCategorized =
//         true;

//       console.log(
//         "AI Updated:",
//         enrichedTransaction.description,
//         "=>",
//         aiCategory
//       );

//     } catch (error) {

//       console.error(
//         "Background AI update failed:",
//         error
//       );
//     }

//   }, 0);
// }
}

  return categorized;
}