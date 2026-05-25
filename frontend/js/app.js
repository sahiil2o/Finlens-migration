import { AppState } from "./state.js";
import { parseHDFC } from "./parser.js";
import { categorizeTransactions } from "./categorizer.js";
import { renderTable } from "./table.js";
import { renderSummary } from "./summary.js";
import { renderCharts } from "./charts.js";
import {
  initializeFilters,
  refreshFilters
} from "./filters.js";

import {
  showLoader,
  hideLoader,
  showToast
} from "./ui.js";

// ===============================
// DOM ELEMENTS
// ===============================

const elements = {

  fileInput:
    document.getElementById(
      "fileInput"
    ),

  dropZone:
    document.getElementById(
      "dropZone"
    ),

  uploadScreen:
    document.getElementById(
      "upload-screen"
    ),

  dashboard:
    document.getElementById(
      "dashboard"
    ),

  errorMsg:
    document.getElementById(
      "error-msg"
    )
};

// ===============================
// GLOBALS
// ===============================

let pollingStarted = false;

// ===============================
// INITIALIZE APP
// ===============================

initializeApp();

function initializeApp() {

  setupFileUpload();

  initializeFilters();

  console.log(
    "FinLens initialized"
  );
}

// ===============================
// FILE UPLOAD EVENTS
// ===============================

function setupFileUpload() {

  // File picker
  elements.fileInput.addEventListener(
    "change",
    handleFileSelection
  );

  // Dropzone click
  elements.dropZone.addEventListener(
    "click",
    () => {
      elements.fileInput.click();
    }
  );

  // Drag over
  elements.dropZone.addEventListener(
    "dragover",
    handleDragOver
  );

  // Drag leave
  elements.dropZone.addEventListener(
    "dragleave",
    handleDragLeave
  );

  // Drop
  elements.dropZone.addEventListener(
    "drop",
    handleFileDrop
  );
}

// ===============================
// DRAG EVENTS
// ===============================

function handleDragOver(event) {

  event.preventDefault();

  elements.dropZone.classList.add(
    "drag-over"
  );
}

function handleDragLeave() {

  elements.dropZone.classList.remove(
    "drag-over"
  );
}

function handleFileDrop(event) {

  event.preventDefault();

  elements.dropZone.classList.remove(
    "drag-over"
  );

  const file =
    event.dataTransfer.files[0];

  if (file) {
    processFile(file);
  }
}

// ===============================
// FILE PICKER
// ===============================

function handleFileSelection(event) {

  const file =
    event.target.files[0];

  if (!file) return;

  processFile(file);
}

// ===============================
// MAIN FILE PROCESSING
// ===============================

async function processFile(file) {

  try {

    showLoader(
      "Parsing statement..."
    );

    validateCSV(file);

    const text =
      await file.text();

    const {
      meta,
      transactions
    } = parseHDFC(text);

    // Save statement metadata
    AppState.meta = meta;

    // Categorize transactions
    const categorizedTransactions =
      categorizeTransactions(
        transactions
      );

    console.log(
      "Categorized:",
      categorizedTransactions
    );

    // Save to frontend state
    AppState.transactions =
      categorizedTransactions;

    AppState.filteredTransactions =
      categorizedTransactions;

    console.log(
      "Parsed transactions:",
      transactions
    );

    console.log(
      "Statement metadata:",
      meta
    );

    // ===============================
    // INITIAL UI RENDER
    // ===============================

    renderDashboard();

    hideLoader();

    showToast(
      "Statement loaded successfully"
    );

    elements.fileInput.value = "";

    // ===============================
    // SAVE TO SQLITE
    // ===============================

    fetch(
      "http://localhost:3000/transactions",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          transactions:
            categorizedTransactions
        })
      }
    )
    .then(async () => {

      console.log(
        "Transactions persisted"
      );

      // ===========================
      // INITIAL DB SYNC
      // ===========================

      await loadTransactionsFromDB();

      // ===========================
      // START POLLING
      // ===========================

      if (!pollingStarted) {

        pollingStarted = true;

        setInterval(() => {

          loadTransactionsFromDB();

        }, 5000);
      }
    })
    .catch(error => {

      console.error(
        "Persistence failed:",
        error
      );
    });

  } catch (error) {

    console.error(error);

    hideLoader();

    showToast(
      error.message,
      "error"
    );

    showError(error.message);
  }
}

// ===============================
// LOAD FROM SQLITE
// ===============================

async function loadTransactionsFromDB() {

  try {

    const response =
      await fetch(
        "http://localhost:3000/transactions"
      );

    const transactions =
      await response.json();

    AppState.transactions =
      transactions;

    AppState.filteredTransactions =
      transactions;

    refreshFilters();

  } catch (error) {

    console.error(
      "DB sync failed:",
      error
    );
  }
}

// ===============================
// VALIDATION
// ===============================

function validateCSV(file) {

  if (
    !file.name
      .toLowerCase()
      .endsWith(".csv")
  ) {

    throw new Error(
      "Please upload an HDFC CSV statement."
    );
  }
}

// ===============================
// DASHBOARD RENDER
// ===============================

function renderDashboard() {

  showDashboard();

  renderTable();

  renderSummary();

  renderCharts();
}

// ===============================
// UI HELPERS
// ===============================

function showDashboard() {

  elements.uploadScreen.style.display =
    "none";

  elements.dashboard.style.display =
    "block";
}

function showError(message) {

  elements.errorMsg.textContent =
    message;

  setTimeout(() => {

    elements.errorMsg.textContent =
      "";

  }, 4000);
}