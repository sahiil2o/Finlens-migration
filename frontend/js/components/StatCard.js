// ==========================================
// STAT CARD COMPONENT TEMPLATE
// ==========================================

/**
 * Renders a single dashboard key metric overview widget.
 * 
 * @param {string} label - Card title
 * @param {string} value - Formatted currency or number value
 * @param {string} sub - Descriptive caption
 * @param {string} color - Accent highlight color
 * @returns {string} HTML string
 */
export function renderStatCard(label, value, sub, color) {
  return `
    <div class="stat-card fade-in" style="--card-accent:${color}">
      <p class="stat-label">${label}</p>
      <p class="stat-value">${value}</p>
      <p class="stat-sub">${sub}</p>
    </div>
  `;
}
