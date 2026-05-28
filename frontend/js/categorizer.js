// ===============================
// CATEGORY DEFINITIONS
// ===============================
import { AppState } from "./state.js";
import { API_BASE } from "./config.js";

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
      "coffee",
      "baskin",
      "cream stone",
      "meghana",
      "food plaza",
      "sizzler",
      "kabab",
      "bakery",
      "bakes",
      "burger",
      "kfc",
      "mcdonald",
      "hotel",
      "gongura",
      "canteen",
      "dhaba",
      "kitchen",
      "biryani",
      "sweets",
      "delight",
      "foods",
      "corner house",
      "ice cream",
      "ice c ream",
      "icecream",
      "gelato",
      "momo lab",
      "momo"
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
      "grofers",
      "dmart",
      "reliance fresh",
      "supermarket",
      "grocery"
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
      "nykaa",
      "shoppee",
      "decathlon",
      "zara",
      "lifestyle",
      "fashion",
      "delhivery",
      "dtdc",
      "blue dart"
    ]
  },

  rent: {
    label: "Rent Payment",
    color: "#c084fc",
    keywords: [
      "sowerent",
      "rent payment",
      "house rent",
      "monthly rent"
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
      "broadband",
      "act fibernet",
      "insurance",
      "acko",
      "maintenance",
      "electricity",
      "power",
      "water",
      "tax",
      "emi",
      "society",
      "apple media",
      "appleservices",
      "apple services",
      "apple.com/bill",
      "atria convergence",
      "act broadband",
      "actcorp"
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
      "iocl",
      "shell",
      "gasoline",
      "autocraft",
      "auto craft"
    ]
  },

  entertainment: {
    label: "Entertainment",
    color: "#f472b6",
    keywords: [
      "bookmyshow",
      "pvr",
      "inox",
      "hotstar",
      "youtube",
      "netflix",
      "spotify",
      "gaming",
      "steam",
      "playstation"
    ]
  },

  salary: {
    label: "Salary Income",
    color: "#0ea5e9",
    keywords: [
      "salary",
      "bnp paribas",
      "payroll",
      "stipend"
    ]
  },

  family: {
    label: "Family Support",
    color: "#f43f5e",
    keywords: [
      "swati talekar",
      "nilesh talekar",
      "nishita talekar"
    ]
  },

  reimbursement: {
    label: "Split / Reimbursement",
    color: "#e8f54e",
    keywords: [
      "split",
      "share",
      "contribution",
      "reimbursement",
      "roommate",
      "refund",
      "reversal",
      "cashback",
      "veerabahu",
      "bangaj",
      "aditya",
      "srivastava"
    ]
  },

  payment: {
    label: "Payment / Credit",
    color: "#94a3b8",
    keywords: [
      "payment",
      "autopay",
      "transfer"
    ]
  },

  travel: {
    label: "Travel & Cabs",
    color: "#38bdf8",
    keywords: [
      "uber",
      "ola",
      "irctc",
      "cab",
      "travel",
      "flight",
      "metro",
      "indigo",
      "rapido",
      "indian railways",
      "railsbi",
      "railway",
      "train"
    ]
  },

  health: {
    label: "Health & Pharma",
    color: "#ec4899",
    keywords: [
      "pharma",
      "medical",
      "hospital",
      "clinic",
      "apollo",
      "medplus",
      "practo"
    ]
  },

  investment: {
    label: "Investment",
    color: "#10b981",
    keywords: [
      "groww",
      "zerodha",
      "mutual",
      "broker",
      "securities",
      "investment"
    ]
  },
  
  home: {
    label: "Home Services",
    color: "#d97706",
    keywords: [
      "urban company",
      "urbanclap",
      "home service",
      "housejoy",
      "plumber",
      "carpenter",
      "pest control"
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
      `${API_BASE}/categorize`,
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
    // RULE MATCH
    // ===============================

    let category =
      detectCategory(
        transaction.description
      );

    // Special custom overrides for family support vs splits
    const descLower = (transaction.description || "").toLowerCase();
    const isTrueFamily =
      (descLower.includes("talekar") &&
        (descLower.includes("swati") ||
          descLower.includes("nilesh") ||
          descLower.includes("nishita"))) ||
      descLower.includes("swati talekar") ||
      descLower.includes("nilesh talekar") ||
      descLower.includes("nishita talekar");

    if (isTrueFamily) {
      if (transaction.type === "debit") {
        category = "family";
      } else {
        category = "reimbursement"; // Credits linked to bill payments go to reimbursement
      }
    } else if (category === "family") {
      // Coerce any accidental family matches to other
      category = "other";
    }

    // For credits, if they don't match any specific rule-based category, default to payment
    if (transaction.type === "credit" && category === "other") {
      category = "payment";
    }

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