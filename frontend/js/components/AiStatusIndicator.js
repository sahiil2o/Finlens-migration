import { subscribeToAiStatus, resetAiStatus } from "../services/aiStatusService.js";

/**
 * Initializes and dynamically mounts the premium AI status indicator in the top navbar.
 */
export function initAiStatusIndicator() {
  // Inject style tag once to document head
  const styleId = "ai-status-indicator-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .ai-status-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.72rem;
        font-family: var(--font-mono);
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid var(--border2);
        background: rgba(255, 255, 255, 0.02);
        transition: all 0.2s ease;
      }
      
      .ai-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
      }
      
      .ai-status-idle {
        color: var(--muted);
        border-color: var(--border);
      }
      .ai-status-idle .ai-status-dot {
        background: var(--muted);
      }
      
      .ai-status-processing {
        color: var(--green);
        border-color: rgba(61, 232, 155, 0.15);
      }
      .ai-status-processing .ai-status-dot {
        background: var(--green);
        animation: ai-pulse 1.6s infinite ease-in-out;
      }
      
      .ai-status-paused {
        color: var(--amber);
        border-color: rgba(245, 166, 35, 0.25);
        background: rgba(245, 166, 35, 0.05);
      }
      .ai-status-paused .ai-status-dot {
        background: var(--amber);
      }
      
      .ai-status-retry-btn {
        background: var(--amber);
        color: var(--bg);
        border: none;
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-family: var(--font-mono);
        font-size: 0.65rem;
        font-weight: 600;
        margin-left: 6px;
        transition: opacity 0.15s;
      }
      .ai-status-retry-btn:hover {
        opacity: 0.85;
      }
      
      @keyframes ai-pulse {
        0%, 100% { transform: scale(0.85); opacity: 0.55; }
        50% { transform: scale(1.25); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // Mount dynamically to Top Navigation actions strip
  const navActions = document.querySelector(".nav-actions");
  if (!navActions) return;

  let container = document.getElementById("ai-status-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "ai-status-container";
    // Place it as the first action element
    navActions.insertBefore(container, navActions.firstChild);
  }

  // Subscribe to status updates from service
  subscribeToAiStatus((status) => {
    let html = "";

    if (status.circuitOpen) {
      html = `
        <div class="ai-status-wrapper ai-status-paused">
          <span class="ai-status-dot"></span>
          <span>AI Paused</span>
          <button class="ai-status-retry-btn" id="ai-status-retry">Retry</button>
        </div>
      `;
    } else if (status.processing) {
      const suffix = status.queueLength > 0 ? ` (${status.queueLength} left)` : "";
      html = `
        <div class="ai-status-wrapper ai-status-processing">
          <span class="ai-status-dot"></span>
          <span>AI Enriching...${suffix}</span>
        </div>
      `;
    } else {
      html = `
        <div class="ai-status-wrapper ai-status-idle">
          <span class="ai-status-dot"></span>
          <span>AI Ready</span>
        </div>
      `;
    }

    container.innerHTML = html;

    const retryBtn = container.querySelector("#ai-status-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        retryBtn.disabled = true;
        retryBtn.textContent = "...";
        await resetAiStatus();
      });
    }
  });
}
