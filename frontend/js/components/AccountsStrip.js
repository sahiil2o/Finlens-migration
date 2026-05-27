// ==========================================
// ACCOUNTS CAROUSEL SELECTOR COMPONENT
// ==========================================

import { AppState } from "../state.js";
import { renderOverviewSelectorCard, renderAccountSelectorCard } from "./AccountCard.js";

/**
 * Builds and renders the linked cards/accounts strip carousel.
 * Extracts unique loaded bank names/accounts, calculates net card dues/savings balances,
 * and highlights active selection.
 */
export function renderAccountsStrip() {
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

/**
 * Global account selector click handler attached to window.
 */
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
            limit = 150000;
            savedMeta.creditLimit = limit;
            localStorage.setItem(`meta_${cc}`, JSON.stringify(savedMeta));
          }
          creditLimitSum = Math.max(creditLimitSum, limit);
        } else {
          // Fallback metadata card block if not present
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

  const filters = await import("../filters.js");
  filters.refreshFilters();
  if (window.syncAndPoll && !skipSyncAndPoll) {
    window.syncAndPoll();
  }
};
