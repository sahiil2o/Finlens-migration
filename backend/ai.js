import fs from "fs";
import path from "path";
import { OLLAMA_MODEL } from "./config.js";


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

export const VALID_CATEGORIES = [
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
  "home",
  "other"
];

// ===============================
// LOAD CACHE
// ===============================

export async function loadCache() {
  try {
    const content = await fs.promises.readFile(CACHE_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      try {
        await fs.promises.writeFile(CACHE_PATH, "{}", "utf-8");
      } catch (writeErr) {
        console.error("[AI] Failed to initialize vendor cache file:", writeErr);
      }
    }
    return {};
  }
}

// ===============================
// SAVE CACHE
// ===============================

export async function saveCache(cache) {
  try {
    await fs.promises.writeFile(
      CACHE_PATH,
      JSON.stringify(cache, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("[AI] Failed to save vendor cache file:", err);
  }
}

// ===============================
// PROMPT
// ===============================

function buildPrompt(vendor, customExamples = []) {
  const customSection = customExamples.length > 0
    ? `\nUser-defined Mappings (Learned from your previous manual categorizations):\n${customExamples.join("\n")}\n`
    : "";

  return `You are a financial transaction categorizer for personal expenses.
Categorize the vendor description into one of these strict categories:
- food: Restaurants, food delivery, cafes, bakeries, ice cream joints (e.g. Swiggy, Zomato, Starbucks, Domino's, Corner House, food joints)
- grocery: Supermarkets, quick-commerce, organic stores, daily essentials (e.g. Blinkit, Zepto, BigBasket, Instamart)
- shopping: Apparel, e-commerce, electronics, retail stores, home decor, courier/logistics (e.g. Amazon, Flipkart, Myntra, Ajio, Nykaa, Delhivery)
- rent: Monthly rent payments, house rent, maintenance, landlady/landlord transfers (e.g. Sowerent, rent payment, society rent)
- bills: Utility bills, internet recharges, phone bills, insurance, subscriptions, school fees (e.g. Jio, Airtel, ACT Broadband, Netflix, Spotify, Acko, insurance, Apple Media)
- fuel: Petrol pumps, service stations (e.g. HPCL, BPCL, IOCL, shell, fuel)
- entertainment: Movies, theatres, event bookings, gaming centers (e.g. BookMyShow, PVR, Inox, playzones)
- salary: Salary income, corporate payroll, stipends, paychecks, co-op deposits
- family: Transfers to parents (e.g. Swati Talekar, Nilesh Talekar), sister (e.g. Nishita Talekar), or general family support
- reimbursement: Split-shares, contributions from roommates or friends for shared expenses, dinner splits, refunds, cashback, reversals
- payment: General credit card repayments, general bank transfers, or payment operations not matching rent, salary, family support, or split reimbursement
- travel: Cabs, auto-rickshaws, metro, train bookings, flight tickets, bus rides (e.g., Uber, Ola, IRCTC, MakeMyTrip, Indigo, Indian Railways)
- health: Medical consultations, pharmacies, hospitals, diagnostic centers (e.g., Apollo Pharmacy, Medplus, Practo, clinics)
- investment: Mutual funds, stocks, trading accounts, bank transfers to brokers (e.g., Groww, Zerodha, AngelOne)
- home: Home services, plumbing, repairs, cleaning, salon, pest control, home maintenance (e.g. Urban Company, UrbanClap, Housejoy)
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
${customSection}
Vendor to categorize: "${vendor}"
Response (strictly one word):`;
}

// ===============================
// HEURISTIC CATEGORIZATION RULES
// ===============================

const HEURISTIC_RULES = [
  { 
    match: (norm) => /\blic\b|lic-|^lic$/i.test(norm) || norm.includes("life insurance") || norm.includes("insurance") || norm.includes("acko") || norm.includes("hdfc life") || norm.includes("sbi life") || norm.includes("icici pru") || norm.includes("max life") || norm.includes("nivabupa") || norm.includes("care health") || norm.includes("apple media") || norm.includes("appleservices") || norm.includes("apple services") || norm.includes("apple.com/bill"),
    category: "bills" 
  },
  { 
    match: (norm) => norm.includes("swiggy") || norm.includes("zomato") || norm.includes("starbucks") || norm.includes("dominos") || norm.includes("pizza") || norm.includes("kfc") || norm.includes("mcdonald") || norm.includes("burger king") || norm.includes("restaur") || norm.includes("cafe") || norm.includes("bakery") || norm.includes("dining") || norm.includes("eats") || norm.includes("hotel") || norm.includes("gongura") || norm.includes("canteen") || norm.includes("dhaba") || norm.includes("kitchen") || norm.includes("biryani") || norm.includes("sweets") || norm.includes("delight") || norm.includes("foods") || norm.includes("corner house") || norm.includes("ice cream") || norm.includes("ice c ream") || norm.includes("icecream") || norm.includes("gelato") || norm.includes("momo lab") || norm.includes("momo"),
    category: "food" 
  },
  { 
    match: (norm) => norm.includes("blinkit") || norm.includes("zepto") || norm.includes("bigbasket") || norm.includes("instamart") || norm.includes("grocery") || norm.includes("supermarket") || norm.includes("mart"),
    category: "grocery" 
  },
  { 
    match: (norm) => norm.includes("amazon") || norm.includes("flipkart") || norm.includes("myntra") || norm.includes("ajio") || norm.includes("nykaa") || norm.includes("meesho") || norm.includes("decathlon") || norm.includes("zara") || norm.includes("retail") || norm.includes("shopping") || norm.includes("delhivery") || norm.includes("dtdc") || norm.includes("blue dart") || norm.includes("dhl"),
    category: "shopping" 
  },
  { 
    match: (norm) => (norm.includes("talekar") && (norm.includes("swati") || norm.includes("nilesh") || norm.includes("nishita"))) || norm.includes("swati talekar") || norm.includes("nilesh talekar") || norm.includes("nishita talekar"),
    category: "family" 
  },
  { 
    match: (norm) => norm.includes("rent") || norm.includes("house rent") || norm.includes("maintenance") || norm.includes("society fee"),
    category: "rent" 
  },
  { 
    match: (norm) => norm.includes("jio") || norm.includes("airtel") || norm.includes("fibernet") || norm.includes("broadband") || norm.includes("bsnl") || norm.includes("prepaid") || norm.includes("postpaid") || norm.includes("netflix") || norm.includes("spotify") || norm.includes("youtube premium") || norm.includes("recharge") || norm.includes("electricity") || norm.includes("water bill") || norm.includes("gas bill") || norm.includes("utility") || norm.includes("bescom") || norm.includes("tneb") || norm.includes("atria convergence") || norm.includes("act fibernet") || norm.includes("act broadband") || norm.includes("actcorp"),
    category: "bills" 
  },
  { 
    match: (norm) => norm.includes("hpcl") || norm.includes("bpcl") || norm.includes("iocl") || norm.includes("shell") || norm.includes("petrol") || norm.includes("fuel"),
    category: "fuel" 
  },
  { 
    match: (norm) => norm.includes("bookmyshow") || norm.includes("pvr") || norm.includes("inox") || norm.includes("prime video") || norm.includes("theatre") || norm.includes("cinema") || norm.includes("entertainment"),
    category: "entertainment" 
  },
  { 
    match: (norm) => norm.includes("salary") || norm.includes("stipend") || norm.includes("payroll") || norm.includes("paycheck"),
    category: "salary" 
  },
  { 
    match: (norm) => norm.includes("reimbursement") || norm.includes("split") || norm.includes("roommate") || norm.includes("dinner split") || norm.includes("refund") || norm.includes("cashback") || norm.includes("reversal"),
    category: "reimbursement" 
  },
  { 
    match: (norm) => norm.includes("broker") || norm.includes("groww") || norm.includes("zerodha") || norm.includes("mutual fund") || norm.includes("brokerage") || norm.includes("investment") || norm.includes("trading") || norm.includes("etmoney") || norm.includes("angelone"),
    category: "investment" 
  },
  { 
    match: (norm) => norm.includes("uber") || norm.includes("ola cab") || norm.includes("ola fleet") || norm.includes("irctc") || norm.includes("makemytrip") || norm.includes("flight") || norm.includes("taxi") || norm.includes("cab ") || norm.includes("auto ") || norm.includes("metro") || norm.includes("travel") || norm.includes("rapido") || norm.includes("namma yatri") || norm.includes("indian railways") || norm.includes("railsbi") || norm.includes("railway") || norm.includes("train") || norm.includes("rail"),
    category: "travel" 
  },
  { 
    match: (norm) => norm.includes("pharmacy") || norm.includes("medplus") || norm.includes("apollo") || norm.includes("hospital") || norm.includes("clinic") || norm.includes("medical") || norm.includes("health") || norm.includes("pharmeasy") || norm.includes("practo") || norm.includes("doctor"),
    category: "health" 
  },
  {
    match: (norm) => norm.includes("urban company") || norm.includes("urbanclap") || norm.includes("home service") || norm.includes("housejoy") || norm.includes("plumber") || norm.includes("carpenter") || norm.includes("pest control"),
    category: "home"
  }
];

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

  // ===============================
  // DETERMINISTIC HEURISTIC BYPASS
  // ===============================
  for (const rule of HEURISTIC_RULES) {
    if (rule.match(normalized)) {
      console.log(
        "HEURISTIC HIT:",
        normalized,
        "=>",
        rule.category
      );
      return rule.category;
    }
  }

  const cache =
    await loadCache();

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

  // Extract up to 15 custom examples from the cache to teach the AI in real-time
  const customExamples = [];
  try {
    const keys = Object.keys(cache);
    const selectedKeys = keys.slice(-15);
    for (const k of selectedKeys) {
      customExamples.push(`- "${k.toUpperCase()}" -> ${cache[k]}`);
    }
  } catch (err) {
    console.error("Failed to build custom examples for AI prompt:", err);
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

          model: OLLAMA_MODEL,

          prompt: buildPrompt(
            vendor,
            customExamples
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

    // Coerce accidental family matches to other
    if (category === "family") {
      const isTrueFamily =
        (normalized.includes("talekar") &&
          (normalized.includes("swati") ||
            normalized.includes("nilesh") ||
            normalized.includes("nishita"))) ||
        normalized.includes("swati talekar") ||
        normalized.includes("nilesh talekar") ||
        normalized.includes("nishita talekar");

      if (!isTrueFamily) {
        category = "other";
      }
    }

    // ===============================
    // SAVE TO CACHE
    // ===============================

    cache[normalized] =
      category;

    await saveCache(cache);

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

    throw error;
  }
}
