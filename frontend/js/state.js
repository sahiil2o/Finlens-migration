// ==========================================
// REACTIVE ESM STATE STORE (OBSERVER PATTERN)
// ==========================================

const rawState = {
  // Full transaction history
  transactions: [],

  // Derived filtered state
  filteredTransactions: [],

  // Statement metadata
  meta: {
    statementDate: null,
    totalDue: 0,
    creditLimit: 0
  },

  // Active filters
  filters: {
    search: "",
    category: "",
    type: ""
  },

  // AI + Analytics
  insights: [],

  // Vendor intelligence
  vendors: {},
  vendorCache: {},

  // Polling + Sync
  polling: {
    active: false,
    intervalMs: 5000,
    lastSync: null
  },

  // UI State
  ui: {
    loading: false,
    aiEnriching: false,
    selectedTransaction: null
  },

  // Chart references
  charts: {
    categoryChart: null,
    timelineChart: null
  }
};

// Registered callback map
const listeners = {};

/**
 * Subscribes to a state property modification event.
 * 
 * @param {string} event - The property name (e.g. 'filteredTransactions') or 'change' for any property
 * @param {Function} callback - The callback to run when changes occur
 * @returns {Function} Unsubscribe trigger function
 */
export function subscribe(event, callback) {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
  return () => {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  };
}

/**
 * Notifies all subscribers registered on an event.
 * 
 * @param {string} event - Event topic key
 * @param {any} data - Changed payload
 */
export function notify(event, data) {
  if (listeners[event]) {
    listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[AppState] Error in subscriber callback for "${event}":`, error);
      }
    });
  }
}

// Proxied AppState to intercept sets and publish changes automatically
export const AppState = new Proxy(rawState, {
  set(target, property, value, receiver) {
    const oldValue = target[property];
    const result = Reflect.set(target, property, value, receiver);

    // Notify when a top-level state key gets updated
    if (oldValue !== value) {
      notify(property, value);
      notify("change", { property, oldValue, newValue: value });
    }
    return result;
  }
});