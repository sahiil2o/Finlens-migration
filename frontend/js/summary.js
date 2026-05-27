import { AppState } from "./state.js";

// ===============================
// DOM ELEMENTS
// ===============================

const summaryStrip = document.getElementById("summary-strip");
const utilSection = document.getElementById("util-section");

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
  cardsHtml.push(`
    <div 
      class="account-card overview ${activeAccountId === "" ? "active" : ""}"
      onclick="selectAccount('')"
    >
      <div>
        <p class="account-card-title">All Accounts Overview</p>
        <p class="account-card-subtitle">Aggregated overall spends</p>
      </div>
      <div>
        <p class="account-card-spend">₹${totalSpendAll.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
      </div>
      <div class="account-card-chip"></div>
    </div>
  `);

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

    cardsHtml.push(`
      <div 
        class="account-card ${activeAccountId === acct ? "active" : ""}"
        onclick="selectAccount('${acct}')"
      >
        <div>
          <p class="account-card-title">${title}</p>
          <p class="account-card-subtitle">${subtitle}</p>
        </div>
        <div>
          <p class="account-card-subtitle" style="margin-top: 8px; font-size: 0.62rem; text-transform: uppercase; color: var(--muted);">${balLabel}</p>
          <p class="account-card-spend">₹${Number(balValue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </div>
        <div class="account-card-chip"></div>
      </div>
    `);
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
  // Render accounts selector strip first
  renderAccountsStrip();

  const transactions = AppState.filteredTransactions;
  const meta = AppState.meta || {};

  const isSavingsAccount = meta.accountType === "savings" || (meta.accountId && meta.accountId.includes("Savings"));

  // ===========================
  // SPENDING TRANSACTIONS
  // ===========================

  const spendTransactions = transactions.filter(transaction => {
    if (transaction.type !== "debit") return false;

    const description = transaction.description?.toLowerCase() || "";

    // Exclude payment loops/transfers ONLY if NOT savings account
    if (!isSavingsAccount) {
      if (
        description.includes("credit card") ||
        description.includes("card payment") ||
        description.includes("cc payment") ||
        description.includes("autopay")
      ) {
        return false;
      }
    }

    return true;
  });

  // ===========================
  // CALCULATIONS
  // ===========================

  let totalSpend = spendTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  
  // If it's a savings account, subtract roommate split contributions from the total spent sum!
  let reimbursementCreditsSum = 0;
  if (isSavingsAccount) {
    const reimbursementCredits = transactions.filter(t => t.type === "credit" && t.category === "reimbursement");
    reimbursementCreditsSum = reimbursementCredits.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    totalSpend = Math.max(0, totalSpend - reimbursementCreditsSum);
  }

  const totalCredits = transactions
    .filter(t => t.type === "credit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const txnCount = transactions.length;

  let totalDue = Number(meta.totalDue) || 0;
  if (!isSavingsAccount && totalDue === 0) {
    totalDue = totalSpend; // Fallback to cycle spending if statement due is 0/missing
  }
  
  let creditLimit = Number(meta.creditLimit) || 0;
  // Auto-heal missing credit limits to prevent 0% division bugs
  if (!isSavingsAccount) {
    if (meta.accountId === "all") {
      const uniqueCcs = [...new Set((AppState.transactions || []).map(t => t.sourceBank))].filter(b => b && b.includes("CC"));
      if (creditLimit === 0 && uniqueCcs.length > 0) {
        creditLimit = 150000; // Shared fallback limit
      }
    } else if (creditLimit === 0 && meta.accountId) {
      creditLimit = 150000; // Fallback card limit
      meta.creditLimit = creditLimit;
      localStorage.setItem(`meta_${meta.accountId}`, JSON.stringify(meta));
    }
  }

  const utilization = creditLimit ? ((totalDue / creditLimit) * 100).toFixed(1) : "0.0";

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

  const hasOdLimit = Number(meta.odLimit) > 0;

  if (isSavingsAccount) {
    if (hasOdLimit) {
      const netColor = totalDue < 0 ? "#ff5a5a" : "#3de89b";
      const availableBalance = Number(meta.odLimit) + totalDue;
      summaryStrip.innerHTML = `
        ${buildCard("Total Spend", formatCurrency(totalSpend), "Filtered spend debits", "#ff5a5a")}
        ${buildCard("Payments & Credits", formatCurrency(totalCredits), "Credits received", "#3de89b")}
        ${buildCard("Net Balance", formatCurrency(totalDue), "Closing account balance", netColor)}
        ${buildCard("Available Balance", formatCurrency(availableBalance), "OD + Savings Balance", "#e8f54e")}
      `;
    } else {
      summaryStrip.innerHTML = `
        ${buildCard("Total Spend", formatCurrency(totalSpend), "Filtered spend debits", "#ff5a5a")}
        ${buildCard("Payments & Credits", formatCurrency(totalCredits), "Credits received", "#3de89b")}
        ${buildCard("Transactions", txnCount, "Visible transactions count", "#5e6bff")}
        ${buildCard("Account Balance", formatCurrency(totalDue), "Current savings balance", "#3de89b")}
      `;
    }
  } else {
    summaryStrip.innerHTML = `
      ${buildCard("Total Spend", formatCurrency(totalSpend), "Filtered spend debits", "#ff5a5a")}
      ${buildCard("Payments & Credits", formatCurrency(totalCredits), "Credits received", "#3de89b")}
      ${buildCard("Transactions", txnCount, "Visible transactions count", "#5e6bff")}
      ${buildCard("Total Statement Due", formatCurrency(totalDue), "Current statement balance", "#e8f54e")}
    `;
  }

  // ===========================
  // UTILIZATION SECTION
  // ===========================

  if (isSavingsAccount) {
    if (hasOdLimit) {
      const usedOd = totalDue < 0 ? Math.abs(totalDue) : 0;
      const odLimit = Number(meta.odLimit) || 0;
      const odUtil = odLimit ? ((usedOd / odLimit) * 100).toFixed(1) : "0.0";
      
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
      // 1. Get all transactions for this savings account
      const acctTxns = (AppState.transactions || []).filter(t => t.sourceBank === meta.accountId);
      
      // 2. Find all salary credits
      const salaryCredits = acctTxns.filter(t => t.type === "credit" && t.category === "salary");
      
      // Sort chronologically ascending
      salaryCredits.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      if (salaryCredits.length >= 1) {
        const cycles = [];
        
        for (let i = 0; i < salaryCredits.length; i++) {
          const currentSalary = salaryCredits[i];
          const startDate = new Date(currentSalary.date);
          
          let endDate = null;
          let isCurrentCycle = false;
          
          if (i + 1 < salaryCredits.length) {
            endDate = new Date(salaryCredits[i + 1].date);
          } else {
            isCurrentCycle = true;
            const txnDates = acctTxns.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
            endDate = txnDates.length ? new Date(Math.max(...txnDates)) : new Date();
            endDate.setDate(endDate.getDate() + 1);
          }
          
          const cycleSpendTxns = acctTxns.filter(t => {
            if (t.type !== "debit") return false;
            const tDate = new Date(t.date);
            if (isNaN(tDate.getTime())) return false;
            
            if (tDate < startDate || tDate >= endDate) return false;
            
            // We now KEEP credit card autopays as real spends!
            return true;
          });
          
          const cycleSpend = cycleSpendTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
          
          // Get all roommate split/reimbursement credits during this cycle
          const cycleReimbursementsTxns = acctTxns.filter(t => {
            if (t.type !== "credit" || t.category !== "reimbursement") return false;
            const tDate = new Date(t.date);
            if (isNaN(tDate.getTime())) return false;
            return tDate >= startDate && tDate < endDate;
          });
          
          const cycleReimbursements = cycleReimbursementsTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
          const netSpend = Math.max(0, cycleSpend - cycleReimbursements);

          const endDisplay = i + 1 < salaryCredits.length 
            ? new Date(salaryCredits[i + 1].date) 
            : new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
            
          cycles.push({
            salaryAmount: Number(currentSalary.amount),
            salaryDate: startDate,
            endDate: endDisplay,
            spend: cycleSpend,
            reimbursements: cycleReimbursements,
            netSpend: netSpend,
            isCurrent: isCurrentCycle
          });
        }
        
        cycles.reverse();
        
        const formatDateLabel = (d) => {
          return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        };
        
        const formatPercent = (val) => {
          return `${Number(val).toFixed(1)}%`;
        };
        
        salaryCycleSection.style.display = "flex";
        salaryCycleSection.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <p style="font-family:var(--font-head); font-size:0.85rem; font-weight:600; color:var(--text);">💰 Salary Cycle Spend Tracking</p>
            <p style="font-size:0.68rem; color:var(--muted);">Slices spend between salary credits</p>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${cycles.map((c, idx) => {
              const util = c.salaryAmount ? (c.netSpend / c.salaryAmount) * 100 : 0;
              const barColor = util > 80 ? "var(--red)" : (util > 50 ? "var(--amber)" : "var(--green)");
              const statusText = util > 100 ? "Deficit" : (util > 80 ? "High Spend" : "Healthy Save");
              const statusColor = util > 80 ? "var(--red)" : (util > 50 ? "var(--amber)" : "var(--green)");
              
              return `
                <div style="background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                      <p style="font-size:0.75rem; font-weight:600; color:var(--text);">
                        Cycle: ${formatDateLabel(c.salaryDate)} – ${formatDateLabel(c.endDate)}
                        ${c.isCurrent ? '<span style="font-size:0.6rem; background:rgba(94,107,255,0.15); color:var(--accent2); border:1px solid rgba(94,107,255,0.25); border-radius:4px; padding:1px 5px; margin-left:6px; vertical-align:middle; text-transform:uppercase;">Active</span>' : ''}
                      </p>
                      <p style="font-size:0.65rem; color:var(--muted); margin-top:2px;">Credited: ${formatCurrency(c.salaryAmount)}</p>
                    </div>
                    <div style="text-align:right;">
                      <p style="font-family:var(--font-head); font-size:0.85rem; font-weight:700; color:${statusColor};">${formatPercent(util)} Spent</p>
                      <p style="font-size:0.65rem; color:var(--muted); margin-top:2px;">Net Spent: ${formatCurrency(c.netSpend)}</p>
                    </div>
                  </div>
                  
                  <div style="height:6px; background:var(--surface); border-radius:3px; overflow:hidden;">
                    <div style="height:100%; border-radius:3px; background:${barColor}; width:${Math.min(util, 100)}%;"></div>
                  </div>
                  
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.65rem; color:var(--muted); flex-wrap:wrap; gap:6px;">
                    <span>Outflows: ${formatCurrency(c.spend)} &nbsp;·&nbsp; Splits: −${formatCurrency(c.reimbursements)}</span>
                    <span style="font-weight:600; color:${statusColor}; border:1px solid ${statusColor}; border-radius:10px; padding:1px 8px; font-size:0.6rem; text-transform:uppercase;">${statusText}</span>
                  </div>
                </div>
              `;
            }).join("")}
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
// SUMMARY CARD BUILDER
// ===============================

function buildCard(label, value, sub, color) {
  return `
    <div class="stat-card fade-in" style="--card-accent:${color}">
      <p class="stat-label">${label}</p>
      <p class="stat-value">${value}</p>
      <p class="stat-sub">${sub}</p>
    </div>
  `;
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