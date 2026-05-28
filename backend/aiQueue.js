import { categorizeVendor } from "./ai.js";
import db, { updateVendorCategory } from "./db/index.js";

const queue = [];

let processing = false;
let consecutiveFailures = 0;
let circuitOpen = false;

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

  if (!processing && !circuitOpen) {
    processQueue();
  }
}

// ===============================
// PROCESS QUEUE
// ===============================

async function processQueue() {

  if (processing || circuitOpen) return;

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

      consecutiveFailures = 0; // Reset counter on successful categorization

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

      consecutiveFailures++;
      queue.unshift(transaction); // Return transaction to front of the queue

      if (consecutiveFailures >= 3) {
        circuitOpen = true;
        console.log("Ollama unavailable — AI enrichment paused");
        break; // Stop loop immediately
      }
    }
  }

  processing = false;
}

// ===============================
// STATUS & CONTROLS
// ===============================

export function getQueueStatus() {
  return {
    queueLength: queue.length,
    processing,
    circuitOpen
  };
}

export function resetCircuitBreaker() {
  consecutiveFailures = 0;
  circuitOpen = false;
  console.log("Circuit breaker manually reset.");
  if (!processing && queue.length > 0) {
    processQueue();
  }
}
