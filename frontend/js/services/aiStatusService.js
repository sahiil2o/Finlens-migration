import { API_BASE } from "../config.js";

let status = { queueLength: 0, processing: false, circuitOpen: false };
let intervalId = null;
let callbacks = [];

/**
 * Returns a read-only copy of the last known queue status.
 */
export function getAiStatus() {
  return { ...status };
}

/**
 * Registers an observer callback to be notified when the queue status changes.
 * Invokes the callback immediately with the current cached status for fast bootstrapping.
 */
export function subscribeToAiStatus(callback) {
  callbacks.push(callback);
  callback({ ...status });
  return () => {
    callbacks = callbacks.filter(cb => cb !== callback);
  };
}

/**
 * Distributes the current status to all registered subscribers.
 */
function notifySubscribers() {
  callbacks.forEach(cb => {
    try {
      cb({ ...status });
    } catch (e) {
      console.error("[aiStatusService] Callback failed:", e);
    }
  });
}

/**
 * Executes a single status poll from the backend API.
 */
export async function pollStatus() {
  try {
    const response = await fetch(`${API_BASE}/ai/status`);
    if (!response.ok) return;

    const newStatus = await response.json();

    const hasChanged =
      newStatus.queueLength !== status.queueLength ||
      newStatus.processing !== status.processing ||
      newStatus.circuitOpen !== status.circuitOpen;

    if (hasChanged) {
      status = newStatus;
      notifySubscribers();
    }
  } catch (error) {
    // Handle fetch failures silently - retain last known state
  }
}

/**
 * Begins the 8-second status polling interval.
 */
export function startAiStatusPolling() {
  if (intervalId) return;

  // Poll immediately on startup
  pollStatus();

  intervalId = setInterval(pollStatus, 8000);
}

/**
 * Clears the active status polling interval.
 */
export function stopAiStatusPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Fires the reset request to backend to restore and resume Ollama queue operations.
 */
export async function resetAiStatus() {
  try {
    const response = await fetch(`${API_BASE}/ai/status/reset`, { method: "POST" });
    if (response.ok) {
      await pollStatus();
    }
  } catch (error) {
    console.error("[aiStatusService] Reset status request failed:", error);
  }
}
