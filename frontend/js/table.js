import { AppState } from "./state.js";
import { CATEGORIES } from "./categorizer.js";
import { categoryColors } from "./components/CachePanel.js";
import { API_BASE } from "./config.js";

// ===============================
// DOM ELEMENTS
// ===============================

let tbody;
let txnCount;
let noResults;

// ===============================
// MAIN TABLE RENDER
// ===============================

export function renderTable() {
  if (!tbody) tbody = document.getElementById("tbody");
  if (!txnCount) txnCount = document.getElementById("txn-count");
  if (!noResults) noResults = document.getElementById("no-results");

  const transactions =
    AppState.filteredTransactions;

  txnCount.textContent =
    `${transactions.length} transactions`;

  if (!transactions.length) {

    tbody.innerHTML = "";

    noResults.style.display = "block";

    return;
  }

  noResults.style.display = "none";

  tbody.innerHTML = transactions
    .map(renderTransactionRow)
    .join("");
}

const getSourceBadgeHTML = (sourceBank) => {
  if (!sourceBank) return "";
  const isCC = sourceBank.includes("CC");
  const lastWord = sourceBank.split(" ").pop();
  const icon = isCC ? "💳" : "🏦";
  const shortName = isCC ? `CC •••• ${lastWord}` : `Savings •••• ${lastWord}`;
  
  return `
    <span class="card-badge" style="font-size: 0.58rem; color: var(--muted); background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); padding: 1px 4px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;" title="${sourceBank}">
      <span>${icon}</span>
      <span>${shortName}</span>
    </span>
  `;
};

// ===============================
// SINGLE ROW RENDER
// ===============================

function renderTransactionRow(
  transaction
) {

  // ===========================
  // SAFE FALLBACKS
  // ===========================

  const description =
    transaction.description
    || "Unknown transaction";

  const categoryKey =
    transaction.category
    || "other";

  const category =
    CATEGORIES[categoryKey]
    || CATEGORIES.other;

  const amount =
    Number(transaction.amount)
    || 0;

  // ===========================
  // AMOUNT RENDER
  // ===========================

  const amountHTML =

    transaction.type === "credit"

      ? renderCreditAmount(amount)

      : renderDebitAmount(amount);

  // ===========================
  // TYPE BADGE
  // ===========================

  const typeBadge =

    transaction.type === "credit"

      ? renderCreditBadge()

      : renderDebitBadge();

  // ===========================
  // DESCRIPTION
  // ===========================

  const shortDescription =

    description.length > 38

      ? description.slice(0, 38) + "…"

      : description;

  // ===========================
  // DATE
  // ===========================

  const dateOnly =

    transaction.dateString

      ? transaction.dateString
          .split(" ")[0]

      : "—";

  // ===========================
  // CATEGORY BADGE
  // ===========================

  const categoryBadge =
    renderCategoryBadge(
      transaction,
      category
    );

  // ===========================
  // LINK/OFFSET BADGE OR TRIGGER
  // ===========================
  let offsetHTML = "";
  if (transaction.type === "debit") {
    if (transaction.linkedTransactionHash) {
      // Find the credit transaction that matches this link
      const credit = AppState.transactions.find(t => 
        (t.transactionHash === transaction.linkedTransactionHash || t.transaction_hash === transaction.linkedTransactionHash)
      );
      if (credit) {
        offsetHTML = `
          <div class="linked-offset-badge" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; background: rgba(61, 232, 155, 0.08); border: 1px solid rgba(61, 232, 155, 0.3); color: var(--green); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-family: var(--font-mono);">
            <span>🔗 Offset by ₹${Number(credit.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${credit.description || credit.merchant}</span>
            <span class="unlink-btn" style="cursor: pointer; color: var(--red); font-weight: bold; padding-left: 4px; margin-left: 4px; border-left: 1px solid rgba(255,255,255,0.15);" onclick="event.stopPropagation(); window.unlinkTransaction('${transaction.transactionHash || transaction.transaction_hash}')" title="Remove Link">✕</span>
          </div>
        `;
      } else {
        offsetHTML = `
          <div class="linked-offset-badge" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; background: rgba(61, 232, 155, 0.08); border: 1px solid rgba(61, 232, 155, 0.3); color: var(--green); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-family: var(--font-mono);">
            <span>🔗 Offset Active</span>
            <span class="unlink-btn" style="cursor: pointer; color: var(--red); font-weight: bold; padding-left: 4px; margin-left: 4px; border-left: 1px solid rgba(255,255,255,0.15);" onclick="event.stopPropagation(); window.unlinkTransaction('${transaction.transactionHash || transaction.transaction_hash}')" title="Remove Link">✕</span>
          </div>
        `;
      }
    } else {
      offsetHTML = `
        <div class="link-offset-trigger" style="display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; color: var(--muted); cursor: pointer; font-size: 0.65rem; border: 1px dashed var(--border2); padding: 1px 5px; border-radius: 4px; transition: all 0.2s;" onclick="event.stopPropagation(); window.openLinkModal('${transaction.transactionHash || transaction.transaction_hash}')" onmouseover="this.style.color='var(--accent)'; this.style.borderColor='var(--accent)';" onmouseout="this.style.color='var(--muted)'; this.style.borderColor='var(--border2)';">
          <span>🔗 Link Offset</span>
        </div>
      `;
    }
  }

  return `
    <tr>

      <td class="desc-cell">

        <span
          class="desc-main"
          title="${description}"
        >
          ${shortDescription}
        </span>

        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="desc-date" style="display: inline-block;">
              ${dateOnly}
            </span>
            ${getSourceBadgeHTML(transaction.sourceBank)}
          </div>
          ${offsetHTML}
        </div>

      </td>

      <td>
        ${categoryBadge}
      </td>

      <td style="text-align:right">
        ${amountHTML}
      </td>

      <td style="text-align:center">
        ${typeBadge}
      </td>

    </tr>
  `;
}

// ===============================
// CATEGORY BADGE
// ===============================

function renderCategoryBadge(
  transaction,
  category
) {

  const isEnriching =

    transaction.category === "other"

    &&

    Number(
      transaction.ai_categorized
    ) === 0;

  if (isEnriching) {

    return `
      <select
        class="category-select"
        style="color:#f59e0b;"
        onchange="manuallyCategorize('${transaction.normalized_merchant || transaction.normalizedMerchant}', this.value, this)"
      >
        <option value="" disabled selected>AI enriching...</option>
        <option value="food">Food & Dining</option>
        <option value="grocery">Grocery</option>
        <option value="shopping">Shopping</option>
        <option value="rent">Rent Payment</option>
        <option value="bills">Bills & Recharge</option>
        <option value="fuel">Fuel</option>
        <option value="entertainment">Entertainment</option>
        <option value="salary">Salary Income</option>
        <option value="family">Family Support</option>
        <option value="reimbursement">Split / Reimbursement</option>
        <option value="payment">Payment / Credit</option>
        <option value="travel">Travel & Cabs</option>
        <option value="health">Health & Pharma</option>
        <option value="investment">Investment</option>
        <option value="home">Home Services</option>
        <option value="other">Other</option>
      </select>
    `;
  }

  return `
    <select
      class="category-select"
      style="color:${category.color};"
      onchange="manuallyCategorize('${transaction.normalized_merchant || transaction.normalizedMerchant}', this.value, this)"
    >
      <option value="food" ${transaction.category === "food" ? "selected" : ""}>Food & Dining</option>
      <option value="grocery" ${transaction.category === "grocery" ? "selected" : ""}>Grocery</option>
      <option value="shopping" ${transaction.category === "shopping" ? "selected" : ""}>Shopping</option>
      <option value="rent" ${transaction.category === "rent" ? "selected" : ""}>Rent Payment</option>
      <option value="bills" ${transaction.category === "bills" ? "selected" : ""}>Bills & Recharge</option>
      <option value="fuel" ${transaction.category === "fuel" ? "selected" : ""}>Fuel</option>
      <option value="entertainment" ${transaction.category === "entertainment" ? "selected" : ""}>Entertainment</option>
      <option value="salary" ${transaction.category === "salary" ? "selected" : ""}>Salary Income</option>
      <option value="family" ${transaction.category === "family" ? "selected" : ""}>Family Support</option>
      <option value="reimbursement" ${transaction.category === "reimbursement" ? "selected" : ""}>Split / Reimbursement</option>
      <option value="payment" ${transaction.category === "payment" ? "selected" : ""}>Payment / Credit</option>
      <option value="travel" ${transaction.category === "travel" ? "selected" : ""}>Travel & Cabs</option>
      <option value="health" ${transaction.category === "health" ? "selected" : ""}>Health & Pharma</option>
      <option value="investment" ${transaction.category === "investment" ? "selected" : ""}>Investment</option>
      <option value="home" ${transaction.category === "home" ? "selected" : ""}>Home Services</option>
      <option value="other" ${transaction.category === "other" || !transaction.category ? "selected" : ""}>Other</option>
    </select>
  `;
}

// ===============================
// AMOUNT RENDERERS
// ===============================

function renderDebitAmount(
  amount
) {

  return `
    <span class="amt-debit">
      −₹${amount.toLocaleString(
        "en-IN",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      )}
    </span>
  `;
}

function renderCreditAmount(
  amount
) {

  return `
    <span class="amt-credit">
      +₹${amount.toLocaleString(
        "en-IN",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      )}
    </span>
  `;
}

// ===============================
// TYPE BADGES
// ===============================

function renderDebitBadge() {

  return `
    <span
      style="
        color:var(--red);
        font-size:0.65rem
      "
    >
      DR
    </span>
  `;
}

function renderCreditBadge() {

  return `
    <span
      style="
        color:var(--green);
        font-size:0.65rem
      "
    >
      CR
    </span>
  `;
}

// =================================
// GLOBAL MANUAL OVERRIDE LOGIC
// =================================

async function showToast(msg, type = "success") {
  const ui = await import("./ui.js");
  ui.showToast(msg, type);
}

// ==========================================
// INTERACTIVE LINKED TRANSACTIONS UI LOGIC
// ==========================================

window.openLinkModal = function(debitHash) {
  // Find the debit transaction
  const debit = AppState.transactions.find(t => t.transactionHash === debitHash || t.transaction_hash === debitHash);
  if (!debit) {
    showToast("Transaction not found", "error");
    return;
  }

  // Find all available credit transactions that are NOT salary
  const candidateCredits = AppState.transactions.filter(t => 
    t.type === "credit" && 
    t.category !== "salary"
  );
  
  // Sort them so the most recent ones are at the top
  candidateCredits.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Create or retrieve modal element
  let modal = document.getElementById("link-offset-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "link-offset-modal";
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 400;
      background: rgba(13, 15, 20, 0.85);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono);
    `;
    document.body.appendChild(modal);
  }

  // Render the modal overlay content
  modal.innerHTML = `
    <div style="background: var(--surface); border: 1px solid var(--border2); border-radius: 16px; padding: 1.75rem; width: min(520px, 92vw); max-height: 80vh; display: flex; flex-direction: column; gap: 1.25rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);">
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
        <div>
          <h3 style="font-family: var(--font-head); font-weight: 700; font-size: 1.1rem; color: var(--text); display: flex; align-items: center; gap: 6px;">
            🔗 Link Funding Offset
          </h3>
          <p style="font-size: 0.72rem; color: var(--muted); margin-top: 4px; line-height: 1.4;">
            Offset debit cycles by linking a specific funding credit.
          </p>
        </div>
        <button class="btn-ghost" style="background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 1rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'" onclick="document.getElementById('link-offset-modal').style.display='none'">✕</button>
      </div>

      <!-- Debit Transaction Info Box -->
      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 0.65rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em;">Debit Transaction to Offset</span>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 500; font-size: 0.82rem; color: var(--text); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 280px;" title="${debit.description || debit.merchant}">
            ${debit.description || debit.merchant}
          </span>
          <span style="color: var(--red); font-weight: 600; font-size: 0.85rem; font-variant-numeric: tabular-nums;">
            −₹${Number(debit.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.68rem; color: var(--muted); margin-top: 2px;">
          <span>Date: ${debit.dateString || (debit.date ? debit.date.split('T')[0] : '—')}</span>
          <span>Account: ${debit.sourceBank || 'Savings'}</span>
        </div>
      </div>

      <!-- Candidate Credits List -->
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; max-height: 40vh; padding-right: 4px;">
        <span style="font-size: 0.65rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em;">Select a Credit Transaction</span>
        
        ${candidateCredits.length === 0 ? `
          <div style="text-align: center; color: var(--muted); padding: 2rem; font-size: 0.78rem; border: 1px dashed var(--border); border-radius: 8px;">
            No suitable credits available for linking.
          </div>
        ` : candidateCredits.map(credit => {
          const isLinkedToCurrent = debit.linkedTransactionHash === credit.transactionHash || debit.linkedTransactionHash === credit.transaction_hash;
          
          // Check if credit is already linked to some other debit to show indicator
          const otherDebit = AppState.transactions.find(d => 
            d.type === "debit" && 
            d.transactionHash !== debitHash && 
            d.transaction_hash !== debitHash &&
            (d.linkedTransactionHash === credit.transactionHash || d.linkedTransactionHash === credit.transaction_hash)
          );

          let actionButton = "";
          let rowStyle = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 10px 12px; 
            border: 1px solid var(--border); 
            border-radius: 8px; 
            background: var(--surface2); 
            cursor: pointer; 
            transition: all 0.2s;
          `;
          
          if (isLinkedToCurrent) {
            actionButton = `
              <span style="color: var(--green); font-size: 0.7rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                ✓ Selected
              </span>
            `;
            rowStyle += " border-color: var(--green); background: rgba(61, 232, 155, 0.04);";
          } else if (otherDebit) {
            actionButton = `
              <span style="color: var(--muted); font-size: 0.65rem; font-style: italic;" title="Linked to ${otherDebit.description}">
                Linked elsewhere
              </span>
            `;
            rowStyle += " opacity: 0.6; cursor: not-allowed;";
          } else {
            actionButton = `
              <button class="btn-ghost" style="padding: 4px 10px; font-size: 0.68rem; border-color: var(--border2); border-radius: 6px; cursor: pointer;" onclick="window.linkTransaction('${debitHash}', '${credit.transactionHash || credit.transaction_hash}')">
                Link
              </button>
            `;
          }

          const creditDate = credit.dateString || (credit.date ? credit.date.split('T')[0] : '—');
          
          return `
            <div style="${rowStyle}" ${!otherDebit && !isLinkedToCurrent ? `onclick="window.linkTransaction('${debitHash}', '${credit.transactionHash || credit.transaction_hash}')"` : ""}>
              <div style="display: flex; flex-direction: column; gap: 2px; max-width: 70%;">
                <span style="font-weight: 500; font-size: 0.78rem; color: var(--text); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${credit.description || credit.merchant}">
                  ${credit.description || credit.merchant}
                </span>
                <span style="font-size: 0.65rem; color: var(--muted);">
                  ${creditDate} · Account: ${credit.sourceBank || 'Savings'}
                </span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <span style="color: var(--green); font-weight: 600; font-size: 0.78rem; font-variant-numeric: tabular-nums;">
                  +₹${Number(credit.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                ${actionButton}
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <!-- Footer/Close Actions -->
      <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 0.75rem;">
        <button class="btn-ghost" style="padding: 6px 14px; font-size: 0.75rem; border-radius: 8px; cursor: pointer;" onclick="document.getElementById('link-offset-modal').style.display='none'">
          Close
        </button>
      </div>

    </div>
  `;

  modal.style.display = "flex";
};

window.linkTransaction = async function(debitHash, creditHash) {
  try {
    const response = await fetch(`${API_BASE}/transactions/link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ debitHash, creditHash })
    });

    if (!response.ok) {
      throw new Error("Failed to link transactions on backend");
    }

    // Update state locally
    const debit = AppState.transactions.find(t => t.transactionHash === debitHash || t.transaction_hash === debitHash);
    if (debit) {
      debit.linkedTransactionHash = creditHash;
    }

    // Refresh the local sync to pull fresh data, update totals, and trigger reactive subscriptions
    const { refreshFilters } = await import("./filters.js");
    refreshFilters();

    // Close modal
    const modal = document.getElementById("link-offset-modal");
    if (modal) modal.style.display = "none";

    showToast("Transactions linked successfully!");

  } catch (error) {
    console.error("Failed to link transactions:", error);
    showToast("Failed to link transactions", "error");
  }
};

window.unlinkTransaction = async function(debitHash) {
  try {
    const response = await fetch(`${API_BASE}/transactions/link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ debitHash, creditHash: null })
    });

    if (!response.ok) {
      throw new Error("Failed to unlink transactions on backend");
    }

    // Update state locally
    const debit = AppState.transactions.find(t => t.transactionHash === debitHash || t.transaction_hash === debitHash);
    if (debit) {
      debit.linkedTransactionHash = null;
    }

    // Refresh the local sync to pull fresh data, update totals, and trigger reactive subscriptions
    const { refreshFilters } = await import("./filters.js");
    refreshFilters();

    showToast("Transaction offset removed.");

  } catch (error) {
    console.error("Failed to unlink transactions:", error);
    showToast("Failed to remove offset link", "error");
  }
};