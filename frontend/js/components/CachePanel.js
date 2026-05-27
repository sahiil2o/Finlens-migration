// ==========================================
// VENDOR CATEGORY OVERRIDES CACHE COMPONENT
// ==========================================

import { showToast } from "../ui.js";

export const categoryColors = {
  food: "#ff6b4a",
  grocery: "#f5a623",
  shopping: "#5e6bff",
  rent: "#c084fc",
  bills: "#a78bfa",
  fuel: "#3de89b",
  entertainment: "#f472b6",
  salary: "#0ea5e9",
  family: "#f43f5e",
  reimbursement: "#e8f54e",
  payment: "#94a3b8",
  travel: "#38bdf8",
  health: "#ec4899",
  investment: "#10b981",
  other: "#475569"
};

/**
 * Persists visual category change overrides to backend API and database.
 */
window.manuallyCategorize = async function(normalizedName, category, selectElement) {
  // Snappy immediate UI style adjustment
  if (selectElement && categoryColors[category]) {
    selectElement.style.color = categoryColors[category];
  }

  try {
    const response = await fetch("http://localhost:3000/vendors/categorize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ normalizedName, category })
    });

    if (!response.ok) {
      throw new Error("Override API responded with failure status");
    }

    showToast(`Updated mapping for "${normalizedName}" to ${category}`);

  } catch (error) {
    console.error("Manual overrides failure:", error);
    showToast("Override failed", "error");
  }
};

/**
 * Launches the modal vendor cache configurations dashboard overlay.
 */
window.showCachePanel = async function() {
  const panel = document.getElementById('cache-panel');
  if (panel) {
    panel.style.display = 'flex';
    await window.renderCachePanel();
  }
};

/**
 * Compiles and populates individual saved vendor category maps lists inside modal.
 */
window.renderCachePanel = async function() {
  try {
    const response = await fetch("http://localhost:3000/vendors");
    if (!response.ok) throw new Error("Failed to load mappings");
    
    const vendors = await response.json();
    
    const searchInput = document.getElementById("cache-search");
    const filterText = searchInput ? searchInput.value.toLowerCase() : "";
    
    const filtered = vendors.filter(v => 
      v.display_name.toLowerCase().includes(filterText) || 
      v.normalized_name.toLowerCase().includes(filterText)
    );
    
    const listElement = document.getElementById("cache-list");
    const footerElement = document.getElementById("cache-footer");
    
    if (footerElement) {
      footerElement.textContent = `Showing ${filtered.length} of ${vendors.length} vendors`;
    }
    
    if (!listElement) return;

    if (filtered.length === 0) {
      listElement.innerHTML = `<div class="empty-state">No vendor mappings found.</div>`;
      return;
    }
    
    listElement.innerHTML = filtered.map(v => {
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:8px;">
          <div style="font-size:0.78rem; font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;">${v.display_name}</div>
          <select
            class="category-select"
            style="color:${categoryColors[v.category] || "#475569"}; margin:0;"
            onchange="manuallyCategorize('${v.normalized_name}', this.value, this)"
          >
            <option value="food" ${v.category === "food" ? "selected" : ""}>Food</option>
            <option value="grocery" ${v.category === "grocery" ? "selected" : ""}>Grocery</option>
            <option value="shopping" ${v.category === "shopping" ? "selected" : ""}>Shopping</option>
            <option value="rent" ${v.category === "rent" ? "selected" : ""}>Rent</option>
            <option value="bills" ${v.category === "bills" ? "selected" : ""}>Bills</option>
            <option value="fuel" ${v.category === "fuel" ? "selected" : ""}>Fuel</option>
            <option value="entertainment" ${v.category === "entertainment" ? "selected" : ""}>Entertainment</option>
            <option value="salary" ${v.category === "salary" ? "selected" : ""}>Salary</option>
            <option value="family" ${v.category === "family" ? "selected" : ""}>Family</option>
            <option value="reimbursement" ${v.category === "reimbursement" ? "selected" : ""}>Split / Reimbursement</option>
            <option value="payment" ${v.category === "payment" ? "selected" : ""}>Payment</option>
            <option value="travel" ${v.category === "travel" ? "selected" : ""}>Travel</option>
            <option value="health" ${v.category === "health" ? "selected" : ""}>Health</option>
            <option value="investment" ${v.category === "investment" ? "selected" : ""}>Investment</option>
            <option value="other" ${v.category === "other" || !v.category ? "selected" : ""}>Other</option>
          </select>
        </div>
      `;
    }).join("");
    
  } catch (error) {
    console.error("Cache panel load failed:", error);
  }
};

/**
 * Resets local database cache systems and resets categorizations.
 */
window.clearCache = async function() {
  if (!confirm("Are you sure you want to clear all vendor mappings and database categorization? This will reset all transaction categorization.")) return;
  try {
    const response = await fetch("http://localhost:3000/vendors/clear-cache", { method: "POST" });
    if (!response.ok) throw new Error("Failed to reset database cache");
    
    showToast("Vendor database cache reset successfully.");
    const panel = document.getElementById('cache-panel');
    if (panel) panel.style.display = 'none';
  } catch (error) {
    console.error("Clear cache failed:", error);
    showToast("Failed to clear cache databases.", "error");
  }
};
