// ==========================================
// ACCOUNTS CAROUSEL SELECTOR COMPONENT
// ==========================================

import { AppState } from "../state.js";
import { renderOverviewSelectorCard, renderAccountSelectorCard } from "./AccountCard.js";
import { getAccountMeta, saveAccountMeta } from "../metaStore.js";

/**
 * Builds and renders the linked cards/accounts strip carousel.
 * Extracts unique loaded bank names/accounts, calculates net card dues/savings balances,
 * and highlights active selection.
 */
export function renderAccountsStrip() {
  const container = document.getElementById("accounts-strip");
  if (!container) return;

  const rawTransactions = AppState.transactions || [];
  if (!rawTransactions.length) {
    container.innerHTML = "";
    return;
  }

  const rawAccounts = [...new Set(rawTransactions.map(t => t.sourceBank))].filter(Boolean);
  
  const uniqueAccounts = [];
  let hasCC = false;
  const ccAccounts = [];

  for (const acct of rawAccounts) {
    if (acct.includes("CC")) {
      hasCC = true;
      ccAccounts.push(acct);
    } else {
      uniqueAccounts.push(acct);
    }
  }

  if (hasCC) {
    uniqueAccounts.push("HDFC Credit Card");
  }
  uniqueAccounts.sort();

  // Use currently filtered transactions for calculation of cycle-specific spend balances!
  const transactions = AppState.filteredTransactions || [];

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
        if (t.sourceBank.includes("CC")) {
          accountSpends["HDFC Credit Card"] = (accountSpends["HDFC Credit Card"] || 0) + (Number(t.amount) || 0);
        } else {
          accountSpends[t.sourceBank] = (accountSpends[t.sourceBank] || 0) + (Number(t.amount) || 0);
        }
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
    
    if (acct === "HDFC Credit Card") {
      const last4s = ccAccounts.map(b => b.split(" ").pop()).sort().join(", ");
      title = `Credit Card (HDFC)`;
      subtitle = `Ending in •••• ${last4s}`;
      
      let ccDueSum = 0;
      for (const cc of ccAccounts) {
        try {
          const savedMeta = getAccountMeta(cc);
          if (savedMeta && savedMeta.totalDue) {
            ccDueSum += Number(savedMeta.totalDue);
          }
        } catch {}
      }
      balLabel = "Due";
      balValue = ccDueSum;
    } else if (acct.includes("Savings")) {
      const parts = acct.split(" ");
      const last4 = parts[parts.length - 1];
      title = `Savings Account`;
      subtitle = `Ending in •••• ${last4}`;
      try {
        const savedMeta = getAccountMeta(acct);
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
    if (accountId === "HDFC Credit Card") {
      const uniqueCcs = [...new Set((AppState.transactions || []).map(t => t.sourceBank))].filter(b => b && b.includes("CC"));
      let totalDueSum = 0;
      let creditLimitSum = 230000; // Shared limit
      let latestStmtDate = "";
      let latestDueDate = "";
      const last4s = uniqueCcs.map(cc => cc.split(" ").pop()).sort().join(", ");
      
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

      let newestDate = new Date(0);
      for (const cc of uniqueCcs) {
        const savedMeta = getAccountMeta(cc);
        if (savedMeta) {
          totalDueSum += Number(savedMeta.totalDue) || 0;
          const stmtD = parseDateStr(savedMeta.stmtDate);
          if (stmtD > newestDate) {
            newestDate = stmtD;
            latestStmtDate = savedMeta.stmtDate;
            latestDueDate = savedMeta.dueDate;
          }
        }
      }
      
      AppState.meta = {
        accountId: "HDFC Credit Card",
        accountType: "credit",
        totalDue: totalDueSum,
        creditLimit: creditLimitSum,
        cardLast4: last4s,
        stmtDate: latestStmtDate,
        dueDate: latestDueDate
      };
    } else {
      try {
        const savedMeta = getAccountMeta(accountId);
        if (savedMeta) {
          AppState.meta = savedMeta;
        } else {
          AppState.meta = { accountId };
        }
      } catch {
        AppState.meta = { accountId };
      }
    }
  } else {
    // Overview aggregates credit cards (handling shared limit)
    let totalDueSum = 0;
    let creditLimitSum = 0;
    const uniqueCcs = [...new Set((AppState.transactions || []).map(t => t.sourceBank))].filter(b => b && b.includes("CC"));
    
    for (const cc of uniqueCcs) {
      try {
        const savedMeta = getAccountMeta(cc);
        
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
            saveAccountMeta(savedMeta);
          }
          totalDueSum += ccDue;

          let limit = Number(savedMeta.creditLimit) || 0;
          if (limit === 0) {
            limit = 150000;
            savedMeta.creditLimit = limit;
            saveAccountMeta(savedMeta);
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
          saveAccountMeta(fallbackCC);
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
