// ==========================================
// SQLITE DATA SYNCHRONIZATION SERVICE
// ==========================================

import { AppState } from "../state.js";
import { renderTable } from "../table.js";
import { renderSummary } from "../summary.js";
import { renderCharts } from "../charts.js";
import { refreshFilters } from "../filters.js";
import { renderTrends } from "../trends.js";
import { showToast } from "../ui.js";

let pollingInterval = null;

/**
 * Boots or manages background synchronizations from the SQLite database.
 * Activates poller dynamically ONLY if active transaction categorizations are in progress.
 */
export async function syncAndPoll() {
  await loadTransactionsFromDB();
  await loadVendorAnalytics();
  await loadSubscriptionAnalytics();
  
  if (typeof renderTrends === "function") {
    await renderTrends();
  }

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

/**
 * Fetches transactions lists from SQLite and triggers state/visual synchronizations.
 */
async function loadTransactionsFromDB() {
  try {
    const response = await fetch("http://localhost:3000/transactions");
    if (!response.ok) throw new Error("Failed to fetch transactions");
    
    const transactions = await response.json();
    AppState.transactions = transactions;
    AppState.filteredTransactions = transactions;

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
      const uploadScreen = document.getElementById("upload-screen");
      const dashboard = document.getElementById("dashboard");
      
      if (uploadScreen && dashboard) {
        uploadScreen.style.display = "none";
        dashboard.style.display = "block";
      }

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
    console.error("DB sync failed:", error);
    showToast("Boot Error: " + error.message, "error");
  }
}

/**
 * Fetches and displays top merchant analytics.
 */
async function loadVendorAnalytics() {
  try {
    const accountId = AppState.filters?.accountId || "";
    const response = await fetch(
      `http://localhost:3000/vendors/top?accountId=${encodeURIComponent(accountId)}`
    );

    const vendors = await response.json();
    renderVendorAnalytics(vendors);
  } catch (error) {
    console.error("Vendor analytics failed:", error);
  }
}

/**
 * Fetches and displays subscription detection details.
 */
async function loadSubscriptionAnalytics() {
  try {
    const accountId = AppState.filters?.accountId || "";
    const response = await fetch(
      `http://localhost:3000/subscriptions?accountId=${encodeURIComponent(accountId)}`
    );

    const subscriptions = await response.json();
    renderSubscriptionAnalytics(subscriptions);
  } catch (error) {
    console.error("Subscription analytics failed:", error);
  }
}

// ==========================================
// COMPONENT LIST RENDER HELPERS
// ==========================================

function renderVendorAnalytics(vendors) {
  const vendorList = document.getElementById("vendor-list");
  const vendorTotal = document.getElementById("vendor-total");
  
  if (!vendorList || !vendorTotal) return;

  if (!Array.isArray(vendors) || !vendors.length) {
    vendorList.innerHTML = `<div class="empty-state">No vendor analytics available.</div>`;
    vendorTotal.textContent = "0";
    return;
  }

  vendorTotal.textContent = vendors.length;
  vendorList.innerHTML = vendors.map(vendor => {
    return `
      <div class="vendor-row fade-in">
        <div class="vendor-left">
          <div class="vendor-name">${vendor.display_name}</div>
          <div class="vendor-meta">${vendor.transaction_count} transactions</div>
        </div>
        <div class="vendor-right">
          <div class="vendor-amount">${formatCurrency(vendor.total_spend)}</div>
          <div class="vendor-category">${capitalize(vendor.category || "other")}</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderSubscriptionAnalytics(subscriptions) {
  const subscriptionList = document.getElementById("subscription-list");
  const subscriptionTotal = document.getElementById("subscription-total");

  if (!subscriptionList || !subscriptionTotal) return;

  if (!Array.isArray(subscriptions) || !subscriptions.length) {
    subscriptionList.innerHTML = `<div class="empty-state">No recurring subscriptions detected.</div>`;
    subscriptionTotal.textContent = "0";
    return;
  }

  const recurringTotal = subscriptions.reduce(
    (sum, sub) => sum + Number(sub.averageAmount),
    0
  );

  subscriptionTotal.textContent = formatCurrency(recurringTotal);
  subscriptionList.innerHTML = subscriptions.map(subscription => {
    const confidenceClass = subscription.confidence >= 80 ? "high" : "medium";
    return `
      <div class="subscription-row fade-in">
        <div class="subscription-left">
          <div class="subscription-name">${subscription.displayName}</div>
          <div class="subscription-meta">Every ${subscription.averageGapDays} days · ${subscription.recurringCount} charges</div>
        </div>
        <div class="subscription-right">
          <div class="subscription-amount">${formatCurrency(subscription.averageAmount)}</div>
          <div class="subscription-confidence ${confidenceClass}">${subscription.confidence}% confidence</div>
        </div>
      </div>
    `;
  }).join("");
}

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
