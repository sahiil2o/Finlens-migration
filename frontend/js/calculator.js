// ==========================================
// PURE ANALYTICAL FINANCIAL CALCULATIONS
// ==========================================

/**
 * Calculates spend totals, limits, and utilization metrics for a given account statement.
 * This function is pure and has no DOM or localStorage side-effects.
 * 
 * @param {Array} filteredTransactions - Stored transactions after global filter applications
 * @param {Array} allTransactions - Raw, complete transaction log in state (used for limit healing fallback checking)
 * @param {Object} meta - Account metadata dictionary
 * @returns {Object} Compiled numerical financial metrics
 */
export function calculateSpendTotals(filteredTransactions, allTransactions, meta) {
  const isSavingsAccount = meta.accountType === "savings" || (meta.accountId && meta.accountId.includes("Savings"));

  // 1. Filter Outflows (Debits)
  const spendTransactions = filteredTransactions.filter(transaction => {
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

  // 2. Compute Spend Total
  let totalSpend = spendTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  
  // For savings OD/Overdraft account, net out roommate split contributions
  let reimbursementCreditsSum = 0;
  if (isSavingsAccount) {
    const reimbursementCredits = filteredTransactions.filter(t => t.type === "credit" && t.category === "reimbursement");
    reimbursementCreditsSum = reimbursementCredits.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    totalSpend = Math.max(0, totalSpend - reimbursementCreditsSum);
  }

  // 3. Compute Inflows (Credits)
  const totalCredits = filteredTransactions
    .filter(t => t.type === "credit")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const txnCount = filteredTransactions.length;

  // 4. Compute Outstanding Dues & Fallbacks
  let totalDue = Number(meta.totalDue) || 0;
  if (!isSavingsAccount && totalDue === 0) {
    totalDue = totalSpend; // Fallback to cycle spending if statement due is 0/missing
  }

  // 5. Determine Credit Limits
  let creditLimit = Number(meta.creditLimit) || 0;
  let healedLimit = false;

  if (!isSavingsAccount) {
    if (meta.accountId === "all") {
      const uniqueCcs = [...new Set((allTransactions || []).map(t => t.sourceBank))].filter(b => b && b.includes("CC"));
      if (creditLimit === 0 && uniqueCcs.length > 0) {
        creditLimit = 150000; // Shared fallback limit
      }
    } else if (creditLimit === 0 && meta.accountId) {
      creditLimit = 150000; // Fallback card limit
      healedLimit = true;
    }
  }

  const utilization = creditLimit ? ((totalDue / creditLimit) * 100).toFixed(1) : "0.0";
  const hasOdLimit = Number(meta.odLimit) > 0;
  
  let usedOd = 0;
  let odLimit = 0;
  let odUtil = "0.0";
  let availableBalance = 0;

  if (isSavingsAccount && hasOdLimit) {
    usedOd = totalDue < 0 ? Math.abs(totalDue) : 0;
    odLimit = Number(meta.odLimit) || 0;
    odUtil = odLimit ? ((usedOd / odLimit) * 100).toFixed(1) : "0.0";
    availableBalance = Number(meta.odLimit) + totalDue;
  }

  return {
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
  };
}

/**
 * Slices a savings account's transactions into chronological salary-to-salary cycles,
 * netting out roommate splits (reimbursement) inside each range.
 * 
 * @param {Array} allTransactions - Raw complete transaction log in state
 * @param {string} accountId - Active savings account ID
 * @returns {Array} List of calculated cycle analytics objects
 */
export function calculateSalaryCycles(allTransactions, accountId) {
  if (!allTransactions || !accountId) return [];

  // 1. Get all transactions for this savings account
  const acctTxns = allTransactions.filter(t => t.sourceBank === accountId);
  
  // 2. Find all salary credits
  const salaryCredits = acctTxns.filter(t => t.type === "credit" && t.category === "salary");
  
  // Sort chronologically ascending
  salaryCredits.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  if (salaryCredits.length < 1) return [];

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
      endDate = datesLengthCheck(txnDates) ? new Date(Math.max(...txnDates)) : new Date();
      endDate.setDate(endDate.getDate() + 1);
    }
    
    const cycleSpendTxns = acctTxns.filter(t => {
      if (t.type !== "debit") return false;
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;
      
      if (tDate < startDate || tDate >= endDate) return false;
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

  // Return chronologically descending (newest cycles first) for display
  return [...cycles].reverse();
}

function datesLengthCheck(dates) {
  return dates && dates.length > 0;
}
