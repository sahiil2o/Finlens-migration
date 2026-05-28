import { AppState } from "./state.js";
import { calculateSpendTotals, calculateSalaryCycles } from "./calculator.js";
import { renderStatCard } from "./components/StatCard.js";
import { renderSalaryCycleCard } from "./components/SalaryCycleCard.js";
import { renderAccountsStrip } from "./components/AccountsStrip.js";
import { saveAccountMeta } from "./metaStore.js";

// ===============================
// DOM ELEMENTS
// ===============================

let summaryStrip;
let utilSection;


// ===============================
// MAIN SUMMARY RENDER
// ===============================

export function renderSummary() {
  if (!summaryStrip) summaryStrip = document.getElementById("summary-strip");
  if (!utilSection) utilSection = document.getElementById("util-section");

  // Render accounts selector strip first
  renderAccountsStrip();

  const meta = AppState.meta || {};
  const {
    isSavingsAccount,
    totalSpend,
    totalCredits,
    txnCount,
    totalDue,
    creditLimit,
    healedLimit,
    utilization,
    hasOdLimit,
    usedOd,
    odLimit,
    odUtil,
    availableBalance
  } = calculateSpendTotals(AppState.filteredTransactions || [], AppState.transactions || [], meta);

  if (healedLimit && meta.accountId) {
    meta.creditLimit = creditLimit;
    saveAccountMeta(meta);
  }

  // ===========================
  // UPDATE DYNAMIC NAVBAR METADATA
  // ===========================
  const cardNoEl = document.getElementById("nav-cardno");
  const dateEl = document.getElementById("nav-date");
  const dueEl = document.getElementById("nav-due");
  const navCardContainer = document.getElementById("nav-card");

  if (cardNoEl && dateEl && dueEl && navCardContainer) {
    if (isSavingsAccount) {
      navCardContainer.innerHTML = `Account ending <strong id="nav-cardno">${meta.accountId ? meta.accountId.split(" ").pop() : "—"}</strong>`;
      dateEl.textContent = meta.stmtDate || "—";
      dueEl.textContent = "N/A (Savings)";
    } else if (meta.accountId === "all") {
      navCardContainer.innerHTML = `Cards: <strong id="nav-cardno">Multiple</strong>`;
      dateEl.textContent = "Consolidated";
      dueEl.textContent = "Shared Limit";
    } else {
      navCardContainer.innerHTML = `Card ending <strong id="nav-cardno">${meta.cardLast4 || "—"}</strong>`;
      dateEl.textContent = meta.stmtDate || "—";
      dueEl.textContent = meta.dueDate || "—";
    }
  }

  // ===========================
  // SUMMARY STRIP
  // ===========================

  if (isSavingsAccount) {
    if (hasOdLimit) {
      const netColor = totalDue < 0 ? "#ff5a5a" : "#3de89b";
      summaryStrip.innerHTML = `
        ${renderStatCard("Total Spend", formatCurrency(totalSpend), "Filtered spend debits", "#ff5a5a")}
        ${renderStatCard("Payments & Credits", formatCurrency(totalCredits), "Credits received", "#3de89b")}
        ${renderStatCard("Net Balance", formatCurrency(totalDue), "Closing account balance", netColor)}
        ${renderStatCard("Available Balance", formatCurrency(availableBalance), "OD + Savings Balance", "#e8f54e")}
      `;
    } else {
      summaryStrip.innerHTML = `
        ${renderStatCard("Total Spend", formatCurrency(totalSpend), "Filtered spend debits", "#ff5a5a")}
        ${renderStatCard("Payments & Credits", formatCurrency(totalCredits), "Credits received", "#3de89b")}
        ${renderStatCard("Transactions", txnCount, "Visible transactions count", "#5e6bff")}
        ${renderStatCard("Account Balance", formatCurrency(totalDue), "Current savings balance", "#3de89b")}
      `;
    }
  } else {
    summaryStrip.innerHTML = `
      ${renderStatCard("Total Spend", formatCurrency(totalSpend), "Filtered spend debits", "#ff5a5a")}
      ${renderStatCard("Payments & Credits", formatCurrency(totalCredits), "Credits received", "#3de89b")}
      ${renderStatCard("Transactions", txnCount, "Visible transactions count", "#5e6bff")}
      ${renderStatCard("Total Statement Due", formatCurrency(totalDue), "Current statement balance", "#e8f54e")}
    `;
  }

  // ===========================
  // UTILIZATION SECTION
  // ===========================

  if (isSavingsAccount) {
    if (hasOdLimit) {
      
      utilSection.style.display = "flex";
      utilSection.innerHTML = `
        <div class="util-label-group">
          <p class="util-title">Overdraft Limit Usage</p>
          <p class="util-pct">${odUtil}%</p>
        </div>

        <div class="util-bar-wrap">
          <div class="util-track">
            <div class="util-fill" style="width:${Math.min(odUtil, 100)}%; background: var(--amber);"></div>
          </div>
          <div class="util-meta">
            <span>Drawn OD: ${formatCurrency(usedOd)}</span>
            <span>OD Limit: ${formatCurrency(odLimit)}</span>
          </div>
        </div>

        <div class="util-status ${odUtil > 50 ? "warn" : "good"}" style="color: ${odUtil > 50 ? "var(--amber)" : "var(--green)"}; border-color: ${odUtil > 50 ? "var(--amber)" : "var(--green)"}">
          ${odUtil > 50 ? "Heavy Limit Draw" : "Healthy Balance"}
        </div>
      `;
    } else {
      utilSection.style.display = "none";
    }
  } else {
    const isHigh = utilization > 30;
    const isCritical = utilization > 70;
    const statusClass = isHigh ? "warn" : "good";
    const statusText = isCritical ? "Critical Usage" : (isHigh ? "High usage" : "Healthy");
    const statusStyle = isCritical ? "color: var(--red); border-color: var(--red);" : "";
    const barColor = isCritical ? "var(--red)" : (isHigh ? "var(--amber)" : "var(--green)");

    utilSection.style.display = "flex";
    utilSection.innerHTML = `
      <div class="util-label-group">
        <p class="util-title">Credit utilization (Shared Limit)</p>
        <p class="util-pct">${utilization}%</p>
      </div>

      <div class="util-bar-wrap">
        <div class="util-track">
          <div class="util-fill" style="width:${Math.min(utilization, 100)}%; background: ${barColor};"></div>
        </div>
        <div class="util-meta">
          <span>Used: ${formatCurrency(totalDue)}</span>
          <span>Limit: ${formatCurrency(creditLimit)}</span>
        </div>
      </div>

      <div class="util-status ${statusClass}" style="${statusStyle}">
        ${statusText}
      </div>
    `;
  }

  // ===========================
  // SALARY CYCLE SPEND ANALYTICS
  // ===========================
  const salaryCycleSection = document.getElementById("salary-cycle-section");
  if (salaryCycleSection) {
    if (isSavingsAccount && meta.accountId) {
      const cycles = calculateSalaryCycles(AppState.transactions || [], meta.accountId, meta);
      
      if (cycles.length >= 1) {
        salaryCycleSection.style.display = "flex";
        salaryCycleSection.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <p style="font-family:var(--font-head); font-size:0.85rem; font-weight:600; color:var(--text);">💰 Salary Cycle Spend Tracking</p>
            <p style="font-size:0.68rem; color:var(--muted);">Slices spend between salary credits</p>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${cycles.map(renderSalaryCycleCard).join("")}
          </div>
        `;
      } else {
        salaryCycleSection.style.display = "none";
      }
    } else {
      salaryCycleSection.style.display = "none";
    }
  }
}

// ===============================
// FORMATTERS
// ===============================

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}