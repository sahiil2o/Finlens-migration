export const AppState = {

  // ===========================
  // CORE DATA
  // ===========================

  // Full transaction history
  transactions: [],

  // Derived filtered state
  filteredTransactions: [],

  // ===========================
  // STATEMENT METADATA
  // ===========================

  meta: {

    statementDate: null,

    totalDue: 0,

    creditLimit: 0
  },

  // ===========================
  // ACTIVE FILTERS
  // ===========================

  filters: {

    search: "",

    category: "",

    type: ""
  },

  // ===========================
  // AI + ANALYTICS
  // ===========================

  insights: [],

  // ===========================
  // VENDOR INTELLIGENCE
  // ===========================

  vendors: {},

  vendorCache: {},

  // ===========================
  // POLLING + SYNC
  // ===========================

  polling: {

    active: false,

    intervalMs: 5000,

    lastSync: null
  },

  // ===========================
  // UI STATE
  // ===========================

  ui: {

    loading: false,

    aiEnriching: false,

    selectedTransaction: null
  },

  // ===========================
  // CHART REFERENCES
  // ===========================

  charts: {

    categoryChart: null,

    timelineChart: null
  }
};