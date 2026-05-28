// ==========================================
// SALARY TIMELINE CARD COMPONENT TEMPLATE
// ==========================================

/**
 * Renders a single salary cycle tracking row card.
 * 
 * @param {Object} cycle - Calculated metrics for a specific salary timeline segment
 * @returns {string} HTML string
 */
export function renderSalaryCycleCard(cycle) {
  const util = cycle.totalCredited ? (cycle.spend / cycle.totalCredited) * 100 : 0;
  
  let barColor, statusText, statusColor;
  
  if (util <= 80) {
    barColor = "var(--green)";
    statusText = "Healthy Save";
    statusColor = "var(--green)";
  } else if (util <= 100) {
    barColor = "var(--amber)";
    statusText = "High Spend";
    statusColor = "var(--amber)";
  } else if (cycle.finalSurplus > 0) {
    barColor = "var(--accent2)"; // soft purple/blue representing buffer drawdown
    statusText = "Buffer Spend";
    statusColor = "var(--accent2)";
  } else if (cycle.cumulativeSurplus > 0) {
    barColor = "var(--accent2)"; // soft purple/blue representing buffer drawdown
    statusText = "Buffer Spend";
    statusColor = "var(--accent2)";
  } else {
    barColor = "var(--red)";
    statusText = "Deficit";
    statusColor = "var(--red)";
  }

  const formatDateLabel = (d) => {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatPercent = (val) => {
    return `${Number(val).toFixed(1)}%`;
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatCompactCurrency = (amount) => {
    if (amount >= 1000) {
      const kValue = amount / 1000;
      const formatted = kValue.toFixed(kValue % 1 === 0 ? 0 : 1);
      return `₹${formatted}k`;
    }
    return `₹${Math.round(amount)}`;
  };

  // Build the "Credited:" line
  let creditedLine = `${formatCurrency(cycle.salaryAmount)} (Salary)`;
  if (cycle.cycleCreditsTotal > 0) {
    const categoryLabels = {
      reimbursement: "Splits",
      family: "Family",
      payment: "Transfers",
      other: "Other"
    };

    const categoryParts = [];
    const sortedCategories = Object.entries(cycle.cycleCreditsByCategory || {})
      .sort((a, b) => b[1].total - a[1].total);

    // Limit/truncate category list to at most 3 categories
    const categoriesToShow = sortedCategories.slice(0, 3);

    for (const [cat, info] of categoriesToShow) {
      let label = categoryLabels[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
      categoryParts.push(`${label} ${formatCompactCurrency(info.total)}`);
    }

    creditedLine += ` + ${formatCurrency(cycle.cycleCreditsTotal)} (${categoryParts.join(" · ")}) = ${formatCurrency(cycle.totalCredited)} Total`;
  }

  // Footer color and text logic for Saved amount
  const savedColor = cycle.cycleSavings >= 0 ? "var(--green)" : "var(--red)";

  // Buffer chip logic
  const absSavings = Math.abs(cycle.cycleSavings || 0);
  const formattedSavings = absSavings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let bufferHTML = "";
  if (cycle.openingBalanceKnown === false) {
    bufferHTML = `
      <div style="display:inline-flex; align-items:center; gap:4px; background:rgba(150,150,150,0.08); border:1px solid rgba(150,150,150,0.25); color:var(--muted); border-radius:12px; padding:2px 8px; font-size:0.6rem; font-weight:600; text-transform:uppercase;">
        ❓ Balance Unknown
      </div>
    `;
  } else if (cycle.cycleSavings > 0) {
    bufferHTML = `
      <div style="display:inline-flex; align-items:center; gap:4px; background:rgba(61,232,155,0.08); border:1px solid rgba(61,232,155,0.25); color:var(--green); border-radius:12px; padding:2px 8px; font-size:0.6rem; font-weight:600; text-transform:uppercase;">
        💼 +₹${formattedSavings} saved
      </div>
    `;
  } else if (cycle.cycleSavings < 0) {
    bufferHTML = `
      <div style="display:inline-flex; align-items:center; gap:4px; background:rgba(255,90,90,0.08); border:1px solid rgba(255,90,90,0.25); color:var(--red); border-radius:12px; padding:2px 8px; font-size:0.6rem; font-weight:600; text-transform:uppercase;">
        ⚠️ −₹${formattedSavings} over
      </div>
    `;
  }

  return `
    <div style="background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <p style="font-size:0.75rem; font-weight:600; color:var(--text);">
            Cycle: ${formatDateLabel(cycle.salaryDate)} – ${formatDateLabel(cycle.endDate)}
            ${cycle.isCurrent ? '<span style="font-size:0.6rem; background:rgba(94,107,255,0.15); color:var(--accent2); border:1px solid rgba(94,107,255,0.25); border-radius:4px; padding:1px 5px; margin-left:6px; vertical-align:middle; text-transform:uppercase;">Active</span>' : ''}
          </p>
          <p style="font-size:0.65rem; color:var(--muted); margin-top:2px;">Credited: ${creditedLine}</p>
        </div>
        <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-weight:600; color:${statusColor}; border:1px solid ${statusColor}; border-radius:10px; padding:1px 8px; font-size:0.6rem; text-transform:uppercase; display:inline-block; line-height:1.2;">${statusText}</span>
            <p style="font-family:var(--font-head); font-size:0.85rem; font-weight:700; color:${statusColor}; margin:0;">${formatPercent(util)} Spent</p>
          </div>
          <p style="font-size:0.65rem; color:var(--muted); margin:0;">Total Out: ${formatCurrency(cycle.spend)}</p>
        </div>
      </div>
      
      <div style="height:6px; background:var(--surface); border-radius:3px; overflow:hidden;">
        <div style="height:100%; border-radius:3px; background:${barColor}; width:${Math.min(util, 100)}%;"></div>
      </div>
      
      <div style="height:1px; background:var(--border); margin:2px 0;"></div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.65rem; color:var(--muted); flex-wrap:wrap; gap:6px;">
        <span>Ending Balance: <strong style="color:var(--text);">${formatCurrency(cycle.cumulativeSurplus)}</strong></span>
        ${cycle.odLimit ? `<span>Available (with OD): <strong style="color:var(--green);">${formatCurrency(cycle.cumulativeSurplus + cycle.odLimit)}</strong></span>` : ''}
      </div>

      <div style="height:1px; background:var(--border); margin:2px 0;"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.65rem; color:var(--muted); flex-wrap:wrap; gap:6px;">
        <span>Out: ${formatCurrency(cycle.spend)} &nbsp;·&nbsp; Saved: <span style="color:${savedColor}; font-weight:600;">${formatCurrency(cycle.cycleSavings)}</span></span>
        ${bufferHTML}
      </div>
    </div>
  `;
}
