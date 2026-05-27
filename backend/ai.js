import fs from "fs";
import path from "path";

// ===============================
// CACHE FILE
// ===============================

const CACHE_PATH =
  path.resolve(
    "./vendor-cache.json"
  );

// ===============================
// VALID CATEGORIES
// ===============================

const VALID_CATEGORIES = [
  "food",
  "grocery",
  "shopping",
  "rent",
  "bills",
  "fuel",
  "entertainment",
  "salary",
  "family",
  "reimbursement",
  "payment",
  "travel",
  "health",
  "investment",
  "other"
];

// ===============================
// LOAD CACHE
// ===============================

export function loadCache() {

  try {

    if (
      !fs.existsSync(CACHE_PATH)
    ) {

      fs.writeFileSync(
        CACHE_PATH,
        "{}"
      );
    }

    return JSON.parse(
      fs.readFileSync(
        CACHE_PATH,
        "utf-8"
      )
    );

  } catch {

    return {};
  }
}

// ===============================
// SAVE CACHE
// ===============================

export function saveCache(cache) {

  fs.writeFileSync(
    CACHE_PATH,
    JSON.stringify(
      cache,
      null,
      2
    )
  );
}

// ===============================
// PROMPT
// ===============================

function buildPrompt(vendor) {

  return `You are a financial transaction categorizer for personal expenses.
Categorize the vendor description into one of these strict categories:
- food: Restaurants, food delivery, cafes, bakeries (e.g. Swiggy, Zomato, Starbucks, Domino's, food joints)
- grocery: Supermarkets, quick-commerce, organic stores, daily essentials (e.g. Blinkit, Zepto, BigBasket, Instamart)
- shopping: Apparel, e-commerce, electronics, retail stores, home decor (e.g. Amazon, Flipkart, Myntra, Ajio, Nykaa)
- rent: Monthly rent payments, house rent, maintenance, landlady/landlord transfers (e.g. Sowerent, rent payment, society rent)
- bills: Utility bills, internet recharges, phone bills, insurance, subscriptions, school fees (e.g. Jio, Airtel, ACT Broadband, Netflix, Spotify, Acko, insurance)
- fuel: Petrol pumps, service stations (e.g. HPCL, BPCL, IOCL, shell, fuel)
- entertainment: Movies, theatres, event bookings, gaming centers (e.g. BookMyShow, PVR, Inox, playzones)
- salary: Salary income, corporate payroll, stipends, paychecks, co-op deposits
- family: Transfers to parents (e.g. Swati Talekar, Nilesh Talekar), sister (e.g. Nishita Talekar), or general family support
- reimbursement: Split-shares, contributions from roommates or friends for shared expenses, dinner splits, refunds, cashback, reversals
- payment: General credit card repayments, general bank transfers, or payment operations not matching rent, salary, family support, or split reimbursement
- travel: Cabs, auto-rickshaws, metro, train bookings, flight tickets, bus rides (e.g., Uber, Ola, IRCTC, MakeMyTrip, Indigo)
- health: Medical consultations, pharmacies, hospitals, diagnostic centers (e.g., Apollo Pharmacy, Medplus, Practo, clinics)
- investment: Mutual funds, stocks, trading accounts, bank transfers to brokers (e.g., Groww, Zerodha, AngelOne)
- other: Professional services, custom taxes, general fees, or anything that doesn't fit the above.

Strict Guidelines:
1. Respond with EXACTLY one category name from the list above. Do not output anything else. No punctuation, no quotes, no conversational filler, and no explanation.
2. Vendor names might contain transaction metadata, locations, or noise (e.g., "swiggy star bangalore", "acko com gurgaon", "jio p prepaid"). Use the merchant name part to categorize.

Examples:
- "SWIGGY STARLTD" -> food
- "ZEPTO METROPOLIS" -> grocery
- "AMAZON SELLER SERVICES" -> shopping
- "NETFLIX COM SGP" -> bills
- "ACKO GEN INS" -> bills
- "HPCL PETROL MUMBAI" -> fuel
- "PVR KORAMANGALA" -> entertainment
- "CRED PAYMENT" -> payment
- "UBER RIDE INDIA" -> travel
- "APOLLO PHARMACY BLR" -> health
- "GROWW INVT SOLUTIONS" -> investment
- "SPAYBBPS JIO FIBRE" -> bills
- "SALARY BNP PARIBAS" -> salary
- "UPI-ROOMMATE SPLIT RENT" -> reimbursement
- "SOWERENT TECHNOLOG Y LLP" -> rent
- "UPI-SWATI TALEKAR" -> family
- "UPI-NISHITA N TALEKAR" -> family

Vendor to categorize: "${vendor}"
Response (strictly one word):`;
}

// ===============================
// AI CATEGORIZATION
// ===============================

export async function categorizeVendor(
  vendor
) {

  const normalized =
    vendor
      .toLowerCase()
      .trim();

  const cache =
    loadCache();

  // ===============================
  // CACHE HIT
  // ===============================

  if (cache[normalized]) {

    console.log(
      "CACHE HIT:",
      normalized
    );

    return cache[normalized];
  }

  try {

    console.log(
      "AI REQUEST:",
      normalized
    );

    const response = await fetch(
      "http://localhost:11434/api/generate",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          model: "qwen2.5:3b",

          prompt: buildPrompt(
            vendor
          ),

          stream: false
        })
      }
    );

    const data =
      await response.json();

    let category =
      (data.response || "")
        .trim()
        .toLowerCase();

    category =
      category
        .split("\\n")[0]
        .trim();

    if (
      !VALID_CATEGORIES.includes(
        category
      )
    ) {

      category = "other";
    }

    // ===============================
    // SAVE TO CACHE
    // ===============================

    cache[normalized] =
      category;

    saveCache(cache);

    console.log(
      "CACHE SAVED:",
      normalized,
      "=>",
      category
    );

    return category;

  } catch (error) {

    console.error(
      "Ollama categorization failed:",
      error
    );

    return "other";
  }
}
