import { categorizeVendor } from "./ai.js";
import db from "./database.js";

const queue = [];

let processing = false;

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

// ===============================
// ENQUEUE
// ===============================

export function enqueue(
  transaction
) {

  queue.push(transaction);

  console.log(
    "Queued:",
    transaction.normalizedMerchant
  );

  if (!processing) {
    processQueue();
  }
}

// ===============================
// PROCESS QUEUE
// ===============================

async function processQueue() {

  if (processing) return;

  processing = true;

  while (queue.length > 0) {

    const transaction =
      queue.shift();

    try {

      console.log(
        "AI Processing:",
        transaction.normalizedMerchant
      );

      const category =
        await categorizeVendor(
          transaction.normalizedMerchant
        );

      if (category) {

        await updateVendorCategory(
          transaction.normalizedMerchant,
          category
        );

        console.log(
          `Updated ${transaction.normalizedMerchant} → ${category}`
        );
      }

      await sleep(300);

    } catch (error) {

      console.error(
        "Queue error:",
        error
      );
    }
  }

  processing = false;
}

// ===============================
// UPDATE SQLITE
// ===============================

function updateVendorCategory(
  normalizedMerchant,
  category
) {

  return new Promise(
    (resolve, reject) => {

      db.run(
        `
        UPDATE transactions
        SET category = ?,
            ai_categorized = 1
        WHERE normalized_merchant = ?
        `,
        [
          category,
          normalizedMerchant
        ],
        function (error) {

          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    }
  );
}