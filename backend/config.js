// ==========================================
// NATIVE ES MODULE CONFIGURATION LOADER
// ==========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parses and loads key-value pairs from .env into process.env if present.
 * Zero external dependencies. Designed for native Node ESM environments.
 */
function loadEnv() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        // Ignore empty lines and comments
        if (trimmed && !trimmed.startsWith("#")) {
          const equalsIndex = trimmed.indexOf("=");
          if (equalsIndex > 0) {
            const key = trimmed.slice(0, equalsIndex).trim();
            let val = trimmed.slice(equalsIndex + 1).trim();
            
            // Strip wrapping single/double quotes if present
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            
            process.env[key] = val;
          }
        }
      });
    }
  } catch (error) {
    console.error("[Config] Custom .env configuration loading failed:", error);
  }
}

// Immediately parse environment variables
loadEnv();

// Resolve variables
const rawDbPath = process.env.DB_PATH || "finlens.db";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";
export const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
export const FILE_LIMIT = process.env.FILE_LIMIT || "10mb";
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";
export const NODE_ENV = process.env.NODE_ENV || "development";

// Export validated, type-safe configuration parameters
export const PORT = Number(process.env.PORT) || 3000;

export const DB_PATH = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(__dirname, rawDbPath);

// Startup configurations validation logic
const validLogLevels = ["debug", "info", "warn", "error"];
if (!validLogLevels.includes(LOG_LEVEL.toLowerCase())) {
  console.warn(`[Config WARNING] Invalid LOG_LEVEL configuration: "${LOG_LEVEL}". Defaulting to "info".`);
}

if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`[Config ERROR] Invalid PORT configuration: "${process.env.PORT || PORT}". Port must be an integer between 1 and 65535.`);
  process.exit(1);
}

try {
  new URL(OLLAMA_URL);
} catch (err) {
  console.error(`[Config ERROR] Invalid OLLAMA_URL configuration format: "${OLLAMA_URL}". Must be a valid URL string.`);
  process.exit(1);
}

if (typeof FILE_LIMIT !== "string" || !/^\d+(b|kb|mb|gb)$/i.test(FILE_LIMIT)) {
  console.warn(`[Config WARNING] Unexpected FILE_LIMIT format: "${FILE_LIMIT}". Standard formats are e.g., "10mb", "500kb".`);
}

console.log(`[Config] Startup validation check: DB_PATH=${DB_PATH}, OLLAMA_MODEL=${OLLAMA_MODEL}, OLLAMA_URL=${OLLAMA_URL}, PORT=${PORT}, LOG_LEVEL=${LOG_LEVEL}`);

