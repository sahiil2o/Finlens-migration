// ==========================================
// ACCOUNT CARDS COMPONENT TEMPLATES
// ==========================================

/**
 * Renders the consolidated 'All Accounts Overview' selector card.
 * 
 * @param {number} totalSpendAll - Cumulative spends across all outflow channels
 * @param {boolean} isActive - Active selector status flag
 * @returns {string} HTML string
 */
export function renderOverviewSelectorCard(totalSpendAll, isActive) {
  return `
    <div 
      class="account-card overview ${isActive ? "active" : ""}"
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
  `;
}

/**
 * Renders an individual bank savings account or credit card selection card.
 * 
 * @param {Object} params - Card initialization metadata properties
 * @returns {string} HTML string
 */
export function renderAccountSelectorCard(params) {
  const { title, subtitle, balLabel, balValue, isActive, accountId } = params;
  return `
    <div 
      class="account-card ${isActive ? "active" : ""}"
      onclick="selectAccount('${accountId}')"
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
  `;
}
