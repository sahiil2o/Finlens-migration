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
  const allTxns = allTransactions || [];

  // Helper to adjust debit amounts for explicitly linked credits (Strategy A)
  const getAdjustedDebitAmount = (debit) => {
    let amt = Number(debit.amount || 0);
    const linkedCredits = allTxns.filter(t => 
      t.type === "credit" && 
      (t.linkedTransactionHash === debit.transactionHash || debit.linkedTransactionHash === t.transactionHash)
    );
    const linkedCreditsSum = linkedCredits.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    return Math.max(0, amt - linkedCreditsSum);
  };

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

  // 2. Compute Spend Total (adjusted for Strategy A)
  let totalSpend = spendTransactions.reduce((sum, t) => sum + getAdjustedDebitAmount(t), 0);
  
  // For savings OD/Overdraft account, net out general non-salary credits (Strategy C)
  // excluding any credit that is already explicitly linked to any debit to avoid double-counting
  if (isSavingsAccount) {
    const nettableCredits = filteredTransactions.filter(t => {
      if (t.type !== "credit" || t.category === "salary") return false;
      
      const isExplicitlyLinked = allTxns.some(d => 
        d.type === "debit" && 
        (d.linkedTransactionHash === t.transactionHash || t.linkedTransactionHash === d.transactionHash)
      );
      return !isExplicitlyLinked;
    });

    const nettableCreditsSum = nettableCredits.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    totalSpend = Math.max(0, totalSpend - nettableCreditsSum);
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
export function calculateSalaryCycles(allTransactions, accountId, meta) {
  if (!allTransactions || !accountId) return [];

  // 1. Get all transactions for this savings account
  const acctTxns = allTransactions.filter(t => t.sourceBank === accountId);
  
  // 2. Find all salary credits
  const salaryCredits = acctTxns.filter(t => t.type === "credit" && t.category === "salary");
  
  // Sort chronologically ascending
  salaryCredits.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  if (salaryCredits.length < 1) return [];

  // Consolidate close-together salary deposits within a 5-day window into a single boundary
  const consolidatedSalaries = [];
  for (const credit of salaryCredits) {
    const creditDate = new Date(credit.date);
    
    if (consolidatedSalaries.length > 0) {
      const lastGroup = consolidatedSalaries[consolidatedSalaries.length - 1];
      const lastDate = new Date(lastGroup.date);
      const diffDays = Math.round((creditDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 5) {
        lastGroup.amount += Number(credit.amount);
        lastGroup.credits.push(credit);
        continue;
      }
    }
    
    consolidatedSalaries.push({
      date: credit.date,
      amount: Number(credit.amount),
      credits: [credit]
    });
  }

  const closingBalance = Number(meta ? (meta.totalDue || meta.total_due || 0) : 0);
  const openingBalanceKnown = closingBalance !== 0 && acctTxns.length > 0;

  // Calculate running balance going backwards to get the initial balance
  const balanceMap = {};
  if (openingBalanceKnown) {
    const descendingTxns = [...acctTxns].sort((a, b) => new Date(b.date) - new Date(a.date));
    let currentBal = closingBalance;
    for (const t of descendingTxns) {
      balanceMap[t.transactionHash || t.transaction_hash] = currentBal;
      const amt = Number(t.amount || 0);
      if (t.type === "credit") {
        currentBal -= amt;
      } else {
        currentBal += amt;
      }
    }
  }

  const cycles = [];
  let cumulativeSurplus = 0;

  if (openingBalanceKnown) {
    // Determine opening balance before the first consolidated salary group
    if (consolidatedSalaries.length > 0 && Object.keys(balanceMap).length > 0) {
      const firstGroup = consolidatedSalaries[0];
      const oldestCredit = [...firstGroup.credits].sort((a, b) => new Date(a.date) - new Date(b.date))[0];
      if (oldestCredit) {
        const hash = oldestCredit.transactionHash || oldestCredit.transaction_hash;
        const balAfter = balanceMap[hash];
        if (balAfter !== undefined) {
          cumulativeSurplus = balAfter - Number(oldestCredit.amount || 0);
        }
      }
    }
  } else {
    // Initialize cumulativeSurplus = 0 because the opening balance is unknown
    cumulativeSurplus = 0;
  }
  
  for (let i = 0; i < consolidatedSalaries.length; i++) {
    const currentSalary = consolidatedSalaries[i];
    const startDate = new Date(currentSalary.date);
    
    let endDate = null;
    let isCurrentCycle = false;
    
    if (i + 1 < consolidatedSalaries.length) {
      endDate = new Date(consolidatedSalaries[i + 1].date);
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
    
    // Everything that left the account
    const cycleSpend = cycleSpendTxns.reduce(
      (sum, t) => sum + Number(t.amount || 0), 0
    );
    // Remove Strategy A (linked credit netting) entirely from cycleSpend
    // Every debit counts at face value — no partial netting
    
    // All non-salary credits, grouped by category for display
    const cycleCreditTxns = acctTxns.filter(t => {
      if (t.type !== "credit" || t.category === "salary") return false;
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;
      return tDate >= startDate && tDate < endDate;
    });

    // Group credits by category for the card breakdown display
    const cycleCreditsByCategory = {};
    for (const t of cycleCreditTxns) {
      const cat = t.category || "other";
      if (!cycleCreditsByCategory[cat]) {
        cycleCreditsByCategory[cat] = { total: 0, count: 0 };
      }
      cycleCreditsByCategory[cat].total += Number(t.amount || 0);
      cycleCreditsByCategory[cat].count += 1;
    }

    const cycleCreditsTotal = cycleCreditTxns.reduce(
      (sum, t) => sum + Number(t.amount || 0), 0
    );

    // Total credited this cycle = salary + all other credits
    const totalCredited = currentSalary.amount + cycleCreditsTotal;

    // Saved = everything in minus everything out
    const cycleSavings = totalCredited - cycleSpend;
    cumulativeSurplus += cycleSavings;
 
    const endDisplay = i + 1 < consolidatedSalaries.length 
      ? new Date(consolidatedSalaries[i + 1].date) 
      : new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      
    cycles.push({
      salaryAmount: currentSalary.amount,
      salaryDate: startDate,
      endDate: endDisplay,
      spend: cycleSpend,
      totalCredited: totalCredited,
      cycleCreditsTotal: cycleCreditsTotal,
      cycleCreditsByCategory: cycleCreditsByCategory,
      cycleSavings: cycleSavings,
      cumulativeSurplus: cumulativeSurplus,
      isCurrent: isCurrentCycle,
      openingBalanceKnown: openingBalanceKnown,
      odLimit: Number(meta ? meta.odLimit : 0) || 0
    });
  }

  // After the forward loop completes, capture the final cumulativeSurplus
  // value (the last cycle's cumulative total). Add this as a new field
  // on every cycle object:
  const finalSurplus = cycles.length > 0 ? cycles[cycles.length - 1].cumulativeSurplus : 0;
  for (const c of cycles) {
    c.finalSurplus = finalSurplus;
  }

  // Return chronologically descending (newest cycles first) for display
  return [...cycles].reverse();
}

function datesLengthCheck(dates) {
  return dates && dates.length > 0;
}
