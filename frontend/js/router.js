import { AppState } from "./state.js";

let routerElements = {};

/**
 * Boots the router with initial DOM pointers.
 */
export function initRouter(elements) {
  routerElements = elements;
  
  // Assign handlers to window for compatibility with HTML templates
  window.switchTab = switchTab;
  window.resetApp = resetApp;
}

/**
 * Focuses active tab and hides other categories in the dashboard.
 */
export function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(`tab-${tabId}`);
  if (target) {
    target.classList.add('active');
  }

  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  AppState.activeTab = tabId;
}

/**
 * Clears files inputs and triggers upload screen view.
 */
export function resetApp() {
  if (routerElements.uploadScreen) routerElements.uploadScreen.style.display = "flex";
  if (routerElements.dashboard) routerElements.dashboard.style.display = "none";
  if (routerElements.fileInput) routerElements.fileInput.value = "";
  if (routerElements.errorMsg) routerElements.errorMsg.textContent = "";
}

/**
 * Triggers the main spend/dashboard view.
 */
export function showDashboard() {
  if (routerElements.uploadScreen) routerElements.uploadScreen.style.display = "none";
  if (routerElements.dashboard) routerElements.dashboard.style.display = "block";

  switchTab(AppState.activeTab || "spend");
}

/**
 * Displays error notices on screen temporary.
 */
export function showError(message) {
  if (routerElements.errorMsg) {
    routerElements.errorMsg.textContent = message;
    setTimeout(() => {
      routerElements.errorMsg.textContent = "";
    }, 4000);
  }
}
