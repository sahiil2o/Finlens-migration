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
  "bills",
  "fuel",
  "entertainment",
  "payment",
  "other"
];

// ===============================
// LOAD CACHE
// ===============================

function loadCache() {

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

function saveCache(cache) {

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

  return `
You are a financial transaction categorizer.

Return ONLY one category.

Valid categories:
food
grocery
shopping
bills
fuel
entertainment
payment
other

Vendor:
${vendor}
`;
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
