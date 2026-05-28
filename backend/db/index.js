export {
  generateTransactionHash,
  saveTransactions,
  getTransactions,
  clearTransactions,
  linkTransactions
} from "./transactionRepository.js";

export {
  upsertVendor,
  getVendors,
  getVendorsByAccount,
  getVendorByNormalizedName,
  updateVendorCategory,
  clearVendors
} from "./vendorRepository.js";

export {
  saveAccountMetadata,
  getAccountMetadata
} from "./accountRepository.js";

export { initializeDatabase } from "./connection.js";
export { default as db } from "./connection.js";
export { default } from "./connection.js";

// Custom helper for compatibility
import { clearTransactions } from "./transactionRepository.js";
import { clearVendors } from "./vendorRepository.js";

export async function clearTransactionsAndVendors() {
  await clearVendors();
  await clearTransactions();
}
export async function clearTransactionsAndVendorsCompat() {
  await clearVendors();
  await clearTransactions();
}
