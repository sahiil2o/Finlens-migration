// ==========================================
// FINLENS APPLICATION ORCHESTRATOR
// ==========================================

import { AppState, subscribe } from "./state.js";
import { parseHDFC } from "./parser.js";
import { categorizeTransactions } from "./categorizer.js";
import { renderTable } from "./table.js";
import { renderSummary } from "./summary.js";
import { renderCharts } from "./charts.js";
import { initializeFilters } from "./filters.js";
import { showLoader, hideLoader, showToast } from "./ui.js";
import { renderTrends } from "./trends.js";

// Decoupled Utils, Components & Services
import { loadTemplates } from "./utils/templateLoader.js";
import { setupDragAndDrop } from "./components/DragAndDrop.js";
import { syncAndPoll } from "./services/syncService.js";
import "./components/CachePanel.js"; // Boots vendor cache overrides globally

// ===============================
// DOM ELEMENTS MAP
// ===============================

const elements = {};

function initElements() {
  elements.fileInput = document.getElementById("fileInput");
  elements.dropZone = document.getElementById("dropZone");
  elements.uploadScreen = document.getElementById("upload-screen");
  elements.dashboard = document.getElementById("dashboard");
  elements.errorMsg = document.getElementById("error-msg");
}

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

    // 3. Setup drag & drop uploader component
    setupDragAndDrop(elements, processFile);

    // 4. Register manual file selector event
    elements.fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) processFile(file);
    });

    // 5. Initialize filters
    initializeFilters();

    console.log("FinLens initialized");

    // 6. Auto-load data from local DB on startup
    await syncAndPoll();
  } catch (error) {
    console.error("App boot failure:", error);
    showToast("Boot Error: " + error.message, "error");
  }
}

// ===============================
// MAIN FILE PROCESSING PIPELINE
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

    const categorizedTransactions = categorizeTransactions(transactions);

    console.log("Categorized:", categorizedTransactions);

    AppState.transactions = categorizedTransactions;
    AppState.filteredTransactions = categorizedTransactions;

    renderDashboard();
    hideLoader();
    showToast("Statement loaded successfully");

    elements.fileInput.value = "";

    fetch("http://localhost:3000/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ transactions: categorizedTransactions })
    })
    .then(async () => {
      console.log("Transactions persisted");
      await syncAndPoll();
    })
    .catch(error => {
      console.error("Persistence failed:", error);
    });

  } catch (error) {
    console.error(error);
    hideLoader();
    showToast(error.message, "error");
    showError(error.message);
  }
}

// ===============================
// APP LIFECYCLE & ROUTING HELPERS
// ===============================

function validateFile(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xls")) {
    throw new Error("Please upload an HDFC CSV or XLS statement.");
  }
}

function renderDashboard() {
  showDashboard();
}

function showDashboard() {
  elements.uploadScreen.style.display = "none";
  elements.dashboard.style.display = "block";

  if (window.switchTab) {
    window.switchTab(AppState.activeTab || "spend");
  }
}

function showError(message) {
  elements.errorMsg.textContent = message;
  setTimeout(() => {
    elements.errorMsg.textContent = "";
  }, 4000);
}

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

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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