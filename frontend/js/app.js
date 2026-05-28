// ==========================================
// FINLENS APPLICATION ORCHESTRATOR
// ==========================================

import { AppState, subscribe } from "./state.js";
import { renderTable } from "./table.js";
import { renderSummary } from "./summary.js";
import { renderCharts } from "./charts.js";
import { initializeFilters } from "./filters.js";
import { renderTrends } from "./trends.js";

// Decoupled Utils, Components & Services
import { loadTemplates } from "./utils/templateLoader.js";
import { syncAndPoll } from "./services/syncService.js";
import "./components/CachePanel.js"; // Boots vendor cache overrides globally

import { initUploader } from "./uploader.js";
import { initRouter, showDashboard } from "./router.js";
import { startAiStatusPolling, stopAiStatusPolling } from "./services/aiStatusService.js";
import { initAiStatusIndicator } from "./components/AiStatusIndicator.js";

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

    // 3. Initialize View Router
    initRouter(elements);

    // Intercept window.resetApp to clear AI status polling
    const originalResetApp = window.resetApp;
    window.resetApp = () => {
      stopAiStatusPolling();
      if (typeof originalResetApp === "function") {
        originalResetApp();
      }
    };

    // Mount AI Status indicator to navigation actions
    initAiStatusIndicator();

    // Subscribe to changes in filteredTransactions to automatically trigger UI renders
    subscribe("filteredTransactions", () => {
      renderTable();
      renderSummary();
      renderCharts();
      if (typeof renderTrends === "function") {
        renderTrends();
      }
    });

    // 4. Setup drag & drop and file input uploader events
    initUploader(elements, () => {
      showDashboard();
      // Start polling upon successful statement upload
      startAiStatusPolling();
    });

    // 5. Initialize filters
    initializeFilters();

    console.log("FinLens initialized");

    // 6. Auto-load data from local DB on startup
    await syncAndPoll();

    // Start polling if statement data is already loaded and active on app boot
    startAiStatusPolling();
  } catch (error) {
    console.error("App boot failure:", error);
  }
}