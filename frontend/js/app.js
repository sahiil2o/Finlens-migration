import { AppState, subscribe } from "./state.js";

import { parseHDFC } from "./parser.js";

import {
  categorizeTransactions
} from "./categorizer.js";

import {
  renderTable
} from "./table.js";

import {
  renderSummary
} from "./summary.js";

import {
  renderCharts
} from "./charts.js";

import {
  initializeFilters,
  refreshFilters
} from "./filters.js";

import {
  showLoader,
  hideLoader,
  showToast
} from "./ui.js";

import {
  renderTrends
} from "./trends.js";

// ===============================
// DOM ELEMENTS
// ===============================

const elements = {};

function initElements() {
  elements.fileInput = document.getElementById("fileInput");
  elements.dropZone = document.getElementById("dropZone");
  elements.uploadScreen = document.getElementById("upload-screen");
  elements.dashboard = document.getElementById("dashboard");
  elements.errorMsg = document.getElementById("error-msg");
  elements.vendorList = document.getElementById("vendor-list");
  elements.vendorTotal = document.getElementById("vendor-total");
  elements.subscriptionList = document.getElementById("subscription-list");
  elements.subscriptionTotal = document.getElementById("subscription-total");
}

// ===============================
// DYNAMIC FETCH TEMPLATE LOADER
// ===============================

async function loadTemplates() {
  const mainTemplates = [
    { slotId: "upload-screen", path: "templates/upload.html" },
    { slotId: "dashboard", path: "templates/dashboard.html" }
  ];

  // Load primary screen shell layout in parallel
  await Promise.all(
    mainTemplates.map(async ({ slotId, path }) => {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to load template: ${path}`);
      const text = await resp.text();
      document.getElementById(slotId).innerHTML = text;
    })
  );

  const subTemplates = [
    { slotId: "tab-spend", path: "templates/spend.html" },
    { slotId: "tab-cashflow", path: "templates/cashflow.html" },
    { slotId: "tab-merchants", path: "templates/vendors.html" },
    { slotId: "tab-transactions", path: "templates/table.html" }
  ];

  // Load tab layouts into their respective sub-slots
  await Promise.all(
    subTemplates.map(async ({ slotId, path }) => {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to load tab template: ${path}`);
      const text = await resp.text();
      document.getElementById(slotId).innerHTML = text;
    })
  );
}

// ===============================
// GLOBALS
// ===============================

let pollingInterval = null;

// ===============================
// INITIALIZE APP
// ===============================

initializeApp();

async function initializeApp() {
  try {
    // 1. Fetch structural templates dynamically
    await loadTemplates();

    // 2. Map DOM pointers post-load
    initElements();

    // Subscribe to changes in filteredTransactions to automatically trigger UI renders
    subscribe("filteredTransactions", () => {
      renderTable();
      renderSummary();
      renderCharts();
      if (typeof renderTrends === "function") {
        renderTrends();
      }
    });

    setupFileUpload();

    initializeFilters();

    console.log("FinLens initialized");

    // Auto-load data from local DB on startup
    await syncAndPoll();
  } catch (error) {
    console.error("App boot failure:", error);
    // Render fallbacks or visual indicators if fetching fails
    const toastModule = await import("./ui.js");
    toastModule.showToast("Boot Error: " + error.message, "error");
  }
}

// ===============================
// FILE UPLOAD EVENTS
// ===============================

function setupFileUpload() {

  elements.fileInput.addEventListener(
    "change",
    handleFileSelection
  );

  elements.dropZone.addEventListener(
    "click",
    () => {
      elements.fileInput.click();
    }
  );

  elements.dropZone.addEventListener(
    "dragenter",
    handleDragEnter
  );

  elements.dropZone.addEventListener(
    "dragover",
    handleDragOver
  );

  elements.dropZone.addEventListener(
    "dragleave",
    handleDragLeave
  );

  elements.dropZone.addEventListener(
    "drop",
    handleFileDrop
  );

  // Prevent default drag and drop behaviors on window level to avoid navigating away
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
}

// ===============================
// DRAG EVENTS
// ===============================

function handleDragEnter(event) {

  event.preventDefault();
  event.stopPropagation();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }

  elements.dropZone.classList.add(
    "drag-over"
  );
}

function handleDragOver(event) {

  event.preventDefault();
  event.stopPropagation();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }

  elements.dropZone.classList.add(
    "drag-over"
  );
}

function handleDragLeave(event) {
  event.stopPropagation();
  elements.dropZone.classList.remove(
    "drag-over"
  );
}

function handleFileDrop(event) {

  event.preventDefault();
  event.stopPropagation();

  elements.dropZone.classList.remove(
    "drag-over"
  );

  if (!event.dataTransfer) return;

  let file = null;
  if (event.dataTransfer.items) {
    const item = event.dataTransfer.items[0];
    if (item && item.kind === 'file') {
      file = item.getAsFile();
    }
  }

  if (!file && event.dataTransfer.files) {
    file = event.dataTransfer.files[0];
  }

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

    validateFile(file);

    let meta, transactions;

    if (file.name.toLowerCase().endsWith(".xls")) {
      showLoader("Parsing legacy XLS statement...");
      const buffer = await file.arrayBuffer();
      const response = await fetch("http://localhost:3000/parse-xls", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream"
        },
        body: buffer
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to parse legacy XLS statement");
      }

      const result = await response.json();
      meta = result.meta;
      transactions = result.transactions;
    } else {
      showLoader("Parsing CSV statement...");
      const text = await file.text();
      const result = parseHDFC(text);
      meta = result.meta;
      transactions = result.transactions;
    }

    saveAccountMeta(meta);

    // Persist account metadata to backend database
    fetch("http://localhost:3000/metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ metadata: meta })
    }).catch(err => console.error("Failed to save metadata to backend:", err));

    const categorizedTransactions =

      categorizeTransactions(
        transactions
      );

    console.log(
      "Categorized:",
      categorizedTransactions
    );

    AppState.transactions =
      categorizedTransactions;

    AppState.filteredTransactions =
      categorizedTransactions;

    renderDashboard();

    hideLoader();

    showToast(
      "Statement loaded successfully"
    );

    elements.fileInput.value = "";

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

      await syncAndPoll();
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
// LOAD TRANSACTIONS FROM SQLITE
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

    // Sync and restore account metadata from the backend
    try {
      const metaResponse = await fetch("http://localhost:3000/metadata");
      if (metaResponse.ok) {
        const metaRows = await metaResponse.json();
        for (const meta of metaRows) {
          const frontendMeta = {
            accountId: meta.account_id,
            accountType: meta.account_type,
            cardLast4: meta.card_last4,
            stmtDate: meta.stmt_date,
            dueDate: meta.due_date,
            totalDue: Number(meta.total_due),
            minDue: Number(meta.min_due),
            creditLimit: Number(meta.credit_limit),
            availableLimit: Number(meta.available_limit),
            odLimit: Number(meta.od_limit)
          };
          localStorage.setItem(`meta_${meta.account_id}`, JSON.stringify(frontendMeta));
        }
      }
    } catch (metaErr) {
      console.error("Failed to sync account metadata:", metaErr);
    }

    if (transactions && transactions.length > 0) {
      showDashboard();
      if (window.selectAccount) {
        const activeAccountId = AppState.filters?.accountId || "";
        await window.selectAccount(activeAccountId, true);
      } else {
        refreshFilters();
      }
    } else {
      refreshFilters();
    }

  } catch (error) {

    console.error(
      "DB sync failed:",
      error
    );
    // Dynamic diagnostic toast to alert the user of the exact JS crash trace
    showToast("Boot Error: " + error.message, "error");
  }
}

async function loadVendorAnalytics() {

  try {

    const accountId = AppState.filters?.accountId || "";
    const response =

      await fetch(
        `http://localhost:3000/vendors/top?accountId=${encodeURIComponent(accountId)}`
      );

    const vendors =
      await response.json();

    renderVendorAnalytics(
      vendors
    );

  } catch (error) {

    console.error(
      "Vendor analytics failed:",
      error
    );
  }
}

// ===============================
// LOAD SUBSCRIPTION ANALYTICS
// ===============================

async function loadSubscriptionAnalytics() {

  try {

    const accountId = AppState.filters?.accountId || "";
    const response =

      await fetch(
        `http://localhost:3000/subscriptions?accountId=${encodeURIComponent(accountId)}`
      );

    const subscriptions =
      await response.json();

    renderSubscriptionAnalytics(
      subscriptions
    );

  } catch (error) {

    console.error(
      "Subscription analytics failed:",
      error
    );
  }
}

// ===============================
// RENDER VENDOR ANALYTICS
// ===============================

function renderVendorAnalytics(
  vendors
) {

  if (
    !Array.isArray(vendors)
    ||
    !vendors.length
  ) {

    elements.vendorList.innerHTML = `
      <div class="empty-state">
        No vendor analytics available.
      </div>
    `;

    elements.vendorTotal.textContent =
      "0";

    return;
  }

  elements.vendorTotal.textContent =
    vendors.length;

  elements.vendorList.innerHTML =

    vendors.map(vendor => {

      return `

        <div class="vendor-row fade-in">

          <div class="vendor-left">

            <div class="vendor-name">
              ${vendor.display_name}
            </div>

            <div class="vendor-meta">

              ${vendor.transaction_count}
              transactions

            </div>

          </div>

          <div class="vendor-right">

            <div class="vendor-amount">

              ${formatCurrency(
                vendor.total_spend
              )}

            </div>

            <div class="vendor-category">

              ${capitalize(
                vendor.category
                || "other"
              )}

            </div>

          </div>

        </div>
      `;
    }).join("");
}

// ===============================
// RENDER SUBSCRIPTION ANALYTICS
// ===============================

function renderSubscriptionAnalytics(
  subscriptions
) {

  if (
    !Array.isArray(subscriptions)
    ||
    !subscriptions.length
  ) {

    elements.subscriptionList.innerHTML = `
      <div class="empty-state">
        No recurring subscriptions detected.
      </div>
    `;

    elements.subscriptionTotal.textContent =
      "0";

    return;
  }

  const recurringTotal =

    subscriptions.reduce(
      (sum, subscription) =>

        sum +
        Number(
          subscription.averageAmount
        ),

      0
    );

  elements.subscriptionTotal.textContent =
    formatCurrency(
      recurringTotal
    );

  elements.subscriptionList.innerHTML =

    subscriptions.map(
      subscription => {

        const confidenceClass =

          subscription.confidence >= 80

            ? "high"

            : "medium";

        return `

          <div
            class="
              subscription-row
              fade-in
            "
          >

            <div
              class="
                subscription-left
              "
            >

              <div
                class="
                  subscription-name
                "
              >
                ${subscription.displayName}
              </div>

              <div
                class="
                  subscription-meta
                "
              >

                Every
                ${subscription.averageGapDays}
                days

                ·

                ${subscription.recurringCount}
                charges

              </div>

            </div>

            <div
              class="
                subscription-right
              "
            >

              <div
                class="
                  subscription-amount
                "
              >

                ${formatCurrency(
                  subscription.averageAmount
                )}

              </div>

              <div
                class="
                  subscription-confidence
                  ${confidenceClass}
                "
              >

                ${subscription.confidence}%
                confidence

              </div>

            </div>

          </div>
        `;
      }
    ).join("");
}

// ===============================
// VALIDATION
// ===============================

function validateFile(file) {

  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xls")) {

    throw new Error(
      "Please upload an HDFC CSV or XLS statement."
    );
  }
}

// ===============================
// DASHBOARD RENDER
// ===============================

function renderDashboard() {
  showDashboard();
}

// ===============================
// UI HELPERS
// ===============================

function showDashboard() {

  elements.uploadScreen.style.display =
    "none";

  elements.dashboard.style.display =
    "block";

  // Restore or default tab
  if (window.switchTab) {
    window.switchTab(AppState.activeTab || "spend");
  }
}

function showError(message) {

  elements.errorMsg.textContent =
    message;

  setTimeout(() => {

    elements.errorMsg.textContent =
      "";

  }, 4000);
}

// ===============================
// TAB LIFE CYCLE MANAGER
// ===============================
window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(`tab-${tabId}`);
  if (target) {
    target.classList.add('active');
  }

  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  AppState.activeTab = tabId;
};

window.resetApp = function() {
  elements.uploadScreen.style.display = "flex";
  elements.dashboard.style.display = "none";
  elements.fileInput.value = "";
  elements.errorMsg.textContent = "";
};

window.syncAndPoll = syncAndPoll;

async function syncAndPoll() {
  await loadTransactionsFromDB();
  await loadVendorAnalytics();
  await loadSubscriptionAnalytics();
  await renderTrends();

  // Poller strictly activates ONLY while transactions are being processed by local AI
  const hasEnriching = AppState.transactions.some(
    t => t.category === "other" && Number(t.ai_categorized) === 0
  );

  if (hasEnriching) {
    if (!pollingInterval) {
      console.log("AI enrichment in progress. Booting background poller...");
      pollingInterval = setInterval(syncAndPoll, 5000);
    }
  } else {
    if (pollingInterval) {
      console.log("AI enrichment complete. Shutting down background poller.");
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }
}

// ===============================
// HELPERS
// ===============================

function formatCurrency(amount) {

  return `₹${Number(amount)
    .toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )}`;
}

function capitalize(text) {

  return text.charAt(0)
    .toUpperCase()
    + text.slice(1);
}

// ===============================
// CHRONOLOGICAL METADATA MERGING
// ===============================
function saveAccountMeta(meta) {
  if (!meta || !meta.accountId) return;

  const key = `meta_${meta.accountId}`;
  const existingRaw = localStorage.getItem(key);

  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw);

      const parseDateStr = (dateStr) => {
        if (!dateStr) return new Date(0);
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          let [dd, mm, yyyy] = parts;
          if (yyyy.length === 2) yyyy = "20" + yyyy;
          return new Date(`${yyyy}-${mm}-${dd}`);
        }
        return new Date(dateStr);
      };

      const existingDate = parseDateStr(existing.stmtDate);
      const newDate = parseDateStr(meta.stmtDate);

      // Overwrite ONLY if the uploaded statement is newer or equal
      if (newDate >= existingDate) {
        existing.totalDue = meta.totalDue;
        existing.stmtDate = meta.stmtDate;
        existing.dueDate = meta.dueDate || existing.dueDate;
        existing.availableLimit = meta.availableLimit || existing.availableLimit;
      }

      existing.odLimit = meta.odLimit || existing.odLimit || 0;
      existing.creditLimit = meta.creditLimit || existing.creditLimit || 0;
      existing.cardLast4 = meta.cardLast4 || existing.cardLast4 || "";
      existing.accountType = meta.accountType || existing.accountType || "savings";
      
      localStorage.setItem(key, JSON.stringify(existing));
      AppState.meta = existing;
      return;
    } catch (e) {
      console.error("Failed to merge account metadata:", e);
    }
  }

  localStorage.setItem(key, JSON.stringify(meta));
  AppState.meta = meta;
}