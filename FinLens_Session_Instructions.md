# 🧠 FinLens AI Session Context & Instructions for Incoming Agents

> [!IMPORTANT]
> **ATTENTION INCOMING ANTIGRAVITY AGENTS:** Whenever the user says "lets continue" or boots a new pair-programming session, **you must read this file first** to immediately align with active settings, constraints, and instructions.

---

## 🛠️ Technology Stack & Architecture Constraints

* **Frontend:** Strict ESM (ES Modules) Native Vanilla Javascript, Native HTML5, and Custom Vanilla CSS.
  * **Rule:** Do NOT use React, Next.js, TypeScript, or other heavy compilation frameworks. Keep the core code clean, lightweight, and directly consumable by native browsers.
* **Backend:** Node.js, Express, and SQLite3.

---

## ⚡ Dev Server Management & Critical Rules

1. **Active Dev Ports:**
   * **Backend server:** Runs on `http://localhost:3000` (configured in `backend/`).
   * **Frontend server:** Runs on `http://localhost:53212` (or current port configured via `npx serve frontend`).
2. **⚠️ CRITICAL BACKEND RESTART RULE:**
   * The backend node server runs standard `node server.js` (no hot-reloading tool like nodemon is configured).
   * **Any change made to backend files (`backend/*.js` or `backend/routes/*.js`) WILL NOT take effect until you manually restart the server.**
   * **How to restart:** Find the running backend background task ID, kill it, and re-run `npm start` in the `backend/` directory.

---

## 🪵 Git Version Control Workflow

* **Commit Frequency:** Staged and committed changes must occur at every stable refactoring or feature checkpoint.
* **Format:** Proactively group related modifications, stage them, and write clear, professional, descriptive multi-line commit messages summarizing structural modifications.

---

## 📈 Context History & Active State

* **Completed Phase (May 2026): Codebase Modularization & Refactoring**
  * **Stage 1:** Separated math/analytical financial equations from DOM rendering logic in the frontend (`calculator.js` handles metrics, `summary.js` strictly handles rendering).
  * **Stage 2:** Decoupled SQLite raw queries out of routing controllers in `server.js` into promise-based repository functions in `database.js`.
  * **Stage 3:** Split monolithic routing in `server.js` into modular Express routing files under `/routes/` (for transactions, vendors, and analytics), and moved shared utilities to `helpers.js`.
  * **Stage 4:** Introduced a reactive Pub/Sub state store using a JavaScript Proxy in `state.js`, completely decoupling `filters.js` from visual rendering modules (`table.js`, `summary.js`, `charts.js`, `trends.js`).
  * **Stage 5:** Extracted monolithic inline HTML string interpolation blocks from `summary.js` into modular functional template component modules inside `components/` (e.g. `StatCard.js`, `AccountCard.js`, `SalaryCycleCard.js`).
  * **Result:** `server.js` is a database-agnostic ~40-line mounting wrapper, the frontend components communicate reactively via state-driven events, and visual presentation layers are highly isolated and reusable. The entire workspace is fully functional and stable.

---

## ➡️ Next Steps & Open Work

1. Read current active conversation logs or check in with the user for their next desired feature.
2. Maintain modularity: When adding new APIs or analytical features, place them in the respective router in `/routes/` or create a new modular router, keeping `database.js` as the repository layer and `helpers.js` / `calculator.js` as analytical units.
