import { AppState } from "./state.js";
import { calculateSpendTotals, calculateSalaryCycles } from "./calculator.js";
import { renderStatCard } from "./components/StatCard.js";
import { renderOverviewSelectorCard, renderAccountSelectorCard } from "./components/AccountCard.js";
import { renderSalaryCycleCard } from "./components/SalaryCycleCard.js";

// ===============================
// DOM ELEMENTS
// ===============================

let summaryStrip;
let utilSection;

// ===============================
// ACCOUNTS CAROUSEL SELECTOR
// ===============================

function renderAccountsStrip() {
  const container = document.getElementById("accounts-strip");
  if (!container) return;

  const transactions = AppState.transactions || [];
  if (!transactions.length) {
    container.innerHTML = "";
    return;
  }

  // Find all unique loaded account IDs (sourceBank)
  const uniqueAccounts = [...new Set(transactions.map(t => t.sourceBank))].filter(Boolean).sort();

  const accountSpends = {};
  for (const acct of uniqueAccounts) {
    accountSpends[acct] = 0;
  }

  const isSpend = (t) => {
    if (t.type !== "debit") return false;
    const desc = t.description?.toLowerCase() || "";
    if (t.sourceBank && t.sourceBank.includes("Savings")) {
      return true;
    }
    const excludedPatterns = ["credit card", "card payment", "cc payment", "autopay", "refund", "reversal", "cashback"];
    return !excludedPatterns.some(pat => desc.includes(pat));
  };

  let totalSpendAll = 0;
  for (const t of transactions) {
    if (isSpend(t)) {
      totalSpendAll += Number(t.amount) || 0;
      if (t.sourceBank) {
        accountSpends[t.sourceBank] = (accountSpends[t.sourceBank] || 0) + (Number(t.amount) || 0);
      }
    }
  }

  // Net out roommate contributions (reimbursement credits) from savings spends in the carousel cards
  for (const acct of uniqueAccounts) {
    if (acct.includes("Savings")) {
      const acctReimbursements = transactions.filter(t => t.sourceBank === acct && t.type === "credit" && t.category === "reimbursement");
      const reimbursementsSum = acctReimbursements.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      accountSpends[acct] = Math.max(0, (accountSpends[acct] || 0) - reimbursementsSum);
    }
  }

  const activeAccountId = AppState.filters?.accountId || "";

  const cardsHtml = [];

  // 1. Overall Spends Widget (All Accounts)
  cardsHtml.push(renderOverviewSelectorCard(totalSpendAll, activeAccountId === ""));

  // 2. Individual Cards & Accounts
  for (const acct of uniqueAccounts) {
    let title = acct;
    let subtitle = "Linked Account";
    let balLabel = "Spend";
    let balValue = accountSpends[acct] || 0;
    
    if (acct.includes("CC")) {
      const parts = acct.split(" ");
      const last4 = parts[parts.length - 1];
      title = `Credit Card (HDFC)`;
      subtitle = `Ending in •••• ${last4}`;
      try {
        const savedMeta = JSON.parse(localStorage.getItem(`meta_${acct}`));
        if (savedMeta && savedMeta.totalDue) {
          balLabel = "Due";
          balValue = Number(savedMeta.totalDue);
        }
      } catch {}
    } else if (acct.includes("Savings")) {
      const parts = acct.split(" ");
      const last4 = parts[parts.length - 1];
      title = `Savings Account`;
      subtitle = `Ending in •••• ${last4}`;
      try {
        const savedMeta = JSON.parse(localStorage.getItem(`meta_${acct}`));
        if (savedMeta) {
          if (Number(savedMeta.odLimit) > 0) {
            balLabel = "Available";
            balValue = Number(savedMeta.odLimit) + Number(savedMeta.totalDue);
          } else {
            balLabel = "Balance";
            balValue = Number(savedMeta.totalDue);
          }
        }
      } catch {}
    }

    cardsHtml.push(renderAccountSelectorCard({
      title,
      subtitle,
      balLabel,
      balValue,
      isActive: activeAccountId === acct,
      accountId: acct
    }));
  }

  container.innerHTML = cardsHtml.join("");
}

// Global account selector trigger
window.selectAccount = async function(accountId, skipSyncAndPoll = false) {
  AppState.filters = {
    ...AppState.filters,
    accountId
  };

  if (accountId) {
    try {
      const savedMeta = JSON.parse(localStorage.getItem(`meta_${accountId}`));
      if (savedMeta) {
        AppState.meta = savedMeta;
      } else {
        AppState.meta = { accountId };
      }
    } catch {
      AppState.meta = { accountId };
    }
  } else {
    // Overview aggregates credit cards (handling shared limit)
    let totalDueSum = 0;
    let creditLimitSum = 0;
    const uniqueCcs = [...new Set((AppState.transactions || []).map(t => t.sourceBank))].filter(b => b && b.includes("CC"));
    
    for (const cc of uniqueCcs) {
      try {
        const savedMeta = JSON.parse(localStorage.getItem(`meta_${cc}`));
        
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

        if (savedMeta) {
          let ccDue = Number(savedMeta.totalDue) || 0;
          if (ccDue === 0) {
            const ccTxnsAll = (AppState.transactions || []).filter(t => t.sourceBank === cc);
            const stmtDates = [...new Set(ccTxnsAll.map(t => t.statementDate))].filter(Boolean);
            stmtDates.sort((a, b) => parseDateStr(b) - parseDateStr(a));
            const latestStmt = stmtDates[0];
            const ccTxns = ccTxnsAll.filter(t => t.type === "debit" && (!latestStmt || t.statementDate === latestStmt));
            ccDue = ccTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
            savedMeta.totalDue = ccDue;
            localStorage.setItem(`meta_${cc}`, JSON.stringify(savedMeta));
          }
          totalDueSum += ccDue;

          let limit = Number(savedMeta.creditLimit) || 0;
          if (limit === 0) {
            limit = 150000; // Auto-heal missing credit limit
            savedMeta.creditLimit = limit;
            localStorage.setItem(`meta_${cc}`, JSON.stringify(savedMeta));
          }
          creditLimitSum = Math.max(creditLimitSum, limit); // Shared limit!
        } else {
          // Fallback metadata block if not present
          const ccTxnsAll = (AppState.transactions || []).filter(t => t.sourceBank === cc);
          const stmtDates = [...new Set(ccTxnsAll.map(t => t.statementDate))].filter(Boolean);
          stmtDates.sort((a, b) => parseDateStr(b) - parseDateStr(a));
          const latestStmt = stmtDates[0];
          const ccTxns = ccTxnsAll.filter(t => t.type === "debit" && (!latestStmt || t.statementDate === latestStmt));
          const ccDue = ccTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
          
          const fallbackCC = { accountId: cc, totalDue: ccDue, creditLimit: 150000, accountType: "credit" };
          localStorage.setItem(`meta_${cc}`, JSON.stringify(fallbackCC));
          totalDueSum += ccDue;
          creditLimitSum = Math.max(creditLimitSum, 150000);
        }
      } catch {}
    }
    
    AppState.meta = {
      accountId: "all",
      totalDue: totalDueSum,
      creditLimit: creditLimitSum
    };
  }

  const filters = await import("./filters.js");
  filters.refreshFilters();
  if (window.syncAndPoll && !skipSyncAndPoll) {
    window.syncAndPoll();
  }
};

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
    localStorage.setItem(`meta_${meta.accountId}`, JSON.stringify(meta));
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
      const cycles = calculateSalaryCycles(AppState.transactions || [], meta.accountId);
      
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