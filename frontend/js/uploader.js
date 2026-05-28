import { AppState } from "./state.js";
import { parseHDFC } from "./parser.js";
import { categorizeTransactions } from "./categorizer.js";
import { showLoader, hideLoader, showToast } from "./ui.js";
import { setupDragAndDrop } from "./components/DragAndDrop.js";
import { saveAccountMeta } from "./metaStore.js";
import { syncAndPoll } from "./services/syncService.js";
import { API_BASE } from "./config.js";
import { showError } from "./router.js";

/**
 * Boots manual select and drag-n-drop event bindings for multiple files.
 */
export function initUploader(elements, onSuccess) {
  // 1. Setup drag & drop uploader component for multiple files
  setupDragAndDrop(elements, (files) => {
    const filesArray = Array.isArray(files) ? files : [files];
    processFiles(filesArray, elements, onSuccess);
  });

  // 2. Register manual file selector event for multiple files
  elements.fileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      processFiles(files, elements, onSuccess);
    }
  });
}

/**
 * Sequentially handles multiple statements and runs extraction parses, caching, and server persistence in a queue.
 */
export async function processFiles(files, elements, onSuccess) {
  try {
    // Validate all files first before starting processing
    for (const file of files) {
      validateFile(file);
    }

    let processedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      showLoader(`Parsing statement ${i + 1} of ${files.length} (${file.name})...`);

      let meta, transactions;

      if (file.name.toLowerCase().endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const response = await fetch(`${API_BASE}/parse-xls`, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream"
          },
          body: buffer
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to parse legacy XLS: ${file.name}`);
        }

        const result = await response.json();
        meta = result.meta;
        transactions = result.transactions;
      } else {
        const text = await file.text();
        const result = parseHDFC(text);
        meta = result.meta;
        transactions = result.transactions;
      }

      saveAccountMeta(meta);

      // Persist account metadata to backend database sequentially
      await fetch(`${API_BASE}/metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ metadata: meta })
      }).catch(err => console.error("Failed to save metadata to backend:", err));

      const categorizedTransactions = categorizeTransactions(transactions);
      console.log(`Categorized ${file.name}:`, categorizedTransactions.length);

      // Persist transactions to SQLite sequentially
      showLoader(`Saving ${file.name} to database (${i + 1}/${files.length})...`);
      const persistResponse = await fetch(`${API_BASE}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ transactions: categorizedTransactions })
      });

      if (!persistResponse.ok) {
        throw new Error(`Failed to persist transactions for ${file.name}`);
      }

      processedCount++;
    }

    // Consolidated database sync and insight update
    showLoader("Syncing databases and updating balances...");
    await syncAndPoll();

    if (typeof onSuccess === "function") {
      onSuccess();
    }
    
    hideLoader();
    showToast(`Successfully processed ${processedCount} statement(s)!`);
    elements.fileInput.value = "";

  } catch (error) {
    console.error("Statement queue failure:", error);
    hideLoader();
    showToast(error.message, "error");
    showError(error.message);
  }
}

/**
 * Validates statement extensions are valid HDFC CSV/XLS records.
 */
export function validateFile(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xls")) {
    throw new Error("Please upload an HDFC CSV or XLS statement.");
  }
}
