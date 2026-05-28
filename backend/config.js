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

// Export validated, type-safe configuration parameters
export const PORT = Number(process.env.PORT) || 3000;

export const DB_PATH = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(__dirname, rawDbPath);

