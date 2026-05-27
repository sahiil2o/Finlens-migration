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
  const util = cycle.salaryAmount ? (cycle.netSpend / cycle.salaryAmount) * 100 : 0;
  const barColor = util > 80 ? "var(--red)" : (util > 50 ? "var(--amber)" : "var(--green)");
  const statusText = util > 100 ? "Deficit" : (util > 80 ? "High Spend" : "Healthy Save");
  const statusColor = util > 80 ? "var(--red)" : (util > 50 ? "var(--amber)" : "var(--green)");

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

  return `
    <div style="background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <p style="font-size:0.75rem; font-weight:600; color:var(--text);">
            Cycle: ${formatDateLabel(cycle.salaryDate)} – ${formatDateLabel(cycle.endDate)}
            ${cycle.isCurrent ? '<span style="font-size:0.6rem; background:rgba(94,107,255,0.15); color:var(--accent2); border:1px solid rgba(94,107,255,0.25); border-radius:4px; padding:1px 5px; margin-left:6px; vertical-align:middle; text-transform:uppercase;">Active</span>' : ''}
          </p>
          <p style="font-size:0.65rem; color:var(--muted); margin-top:2px;">Credited: ${formatCurrency(cycle.salaryAmount)}</p>
        </div>
        <div style="text-align:right;">
          <p style="font-family:var(--font-head); font-size:0.85rem; font-weight:700; color:${statusColor};">${formatPercent(util)} Spent</p>
          <p style="font-size:0.65rem; color:var(--muted); margin-top:2px;">Net Spent: ${formatCurrency(cycle.netSpend)}</p>
        </div>
      </div>
      
      <div style="height:6px; background:var(--surface); border-radius:3px; overflow:hidden;">
        <div style="height:100%; border-radius:3px; background:${barColor}; width:${Math.min(util, 100)}%;"></div>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.65rem; color:var(--muted); flex-wrap:wrap; gap:6px;">
        <span>Outflows: ${formatCurrency(cycle.spend)} &nbsp;·&nbsp; Splits: −${formatCurrency(cycle.reimbursements)}</span>
        <span style="font-weight:600; color:${statusColor}; border:1px solid ${statusColor}; border-radius:10px; padding:1px 8px; font-size:0.6rem; text-transform:uppercase;">${statusText}</span>
      </div>
    </div>
  `;
}
