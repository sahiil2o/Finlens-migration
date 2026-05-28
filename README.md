# FinLens — Personal Finance Intelligence Platform

## 1. Project Overview
FinLens is a local-first, AI-powered personal finance intelligence platform that helps users analyze and track their banking and credit card statements. It resolves the privacy concerns of traditional finance apps by parsing bank statements, computing transaction analytics, and performing AI vendor enrichment entirely on the user's local machine without cloud dependencies.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js (v18+) | Core server-side JavaScript engine. |
| **Web Framework** | Express.js | Exposes local endpoints for statement parsing, history queries, and AI status. |
| **Database** | SQLite3 | File-based, high-performance database with custom indexing (no setup required). |
| **AI Layer** | Ollama LLM (`qwen2.5:3b`) | Local intelligence model for vendor categorization. |
| **Frontend** | Vanilla HTML5 / Vanilla CSS | Fast, lightweight UI layout styling utilizing harmonized theme colors. |
| **Charting** | Chart.js | Visual distributions of categories, chronological trendlines, and cycles. |
| **Statement Parsing** | Python 3 + `xlrd` (legacy XLS) / Vanilla JS (CSV) | Statement loaders that parse HDFC credit card and savings statements. |

---

## 3. Project Structure

```text
FinLens/
├── backend/
│   ├── db/
│   │   ├── connection.js             # Manages database connection and executes schema migrations
│   │   ├── transactionRepository.js  # Database CRUD operations for saving and fetching transaction rows
│   │   ├── vendorRepository.js       # Database CRUD operations for saved merchants, spends, and manual overrides
│   │   ├── accountRepository.js      # Database CRUD operations for statement metadata and limits
│   │   └── index.js                  # Barrel export file providing unified access to connection and repositories
│   ├── controllers/
│   │   ├── analyticsController.js    # Logic for trend analytics, monthly forecasts, and subscription detection
│   │   ├── transactionsController.js # Handles XLS parsing execution and transaction/metadata persistence
│   │   └── vendorsController.js      # Logic for merchant profiles, manual categorization, and cache clearing
│   ├── routes/
│   │   ├── analytics.js              # Routing paths for trends and recurring subscriptions
│   │   ├── transactions.js           # Routing paths for transaction logs, parsed statements, and AI status
│   │   └── vendors.js                # Routing paths for vendor lists, overrides, and clearing caches
│   ├── ai.js                         # Interface to local Ollama API and categorization logic
│   ├── aiQueue.js                    # In-memory AI enrichment queue protecting against model disconnects
│   ├── config.js                     # Global backend configurations (ports, DB paths)
│   ├── helpers.js                    # Backend utilities (spend validation, subscription detection)
│   ├── parse_xls.py                  # Python legacy XLS workbook extractor script using xlrd
│   ├── schema.sql                    # SQL script establishing SQLite table schemas and performance indexes
│   └── server.js                     # Server launcher mounting middlewares, routes, and starting the express app
├── frontend/
│   ├── css/
│   │   ├── global.css                # Visual themes, topography variables, layouts, and tops navigation styles
│   │   ├── dashboard.css             # Styles for accounts strip, summary widgets, and utility bars
│   │   ├── table.css                 # Table grid layouts for transaction listings
│   │   ├── trends.css                # Glassmorphic trends forecasting and insight card layouts
│   │   └── upload.css                # Drag-and-drop landing upload screen styling
│   ├── js/
│   │   ├── components/
│   │   │   ├── AccountCard.js        # Individual carousel cards for savings and credit cards
│   │   │   ├── AccountsStrip.js      # Horizontal selection carousel holding multiple card balances
│   │   │   ├── AiStatusIndicator.js  # Navbar component rendering real-time AI states and Retry actions
│   │   │   ├── CachePanel.js         # Settings modal rendering custom merchant classification overrides
│   │   │   ├── DragAndDrop.js        # Visual drag-n-drop file uploader wrapper
│   │   │   ├── SalaryCycleCard.js    # Display cards for salary-to-salary period spending
│   │   │   └── StatCard.js           # Stat numbers for the main dashboard display
│   │   ├── services/
│   │   │   ├── aiStatusService.js    # Manages status polling cycles and observer notifications
│   │   │   └── syncService.js        # Synchronizes state data from backend database to local states
│   │   ├── utils/
│   │   │   ├── filterEngine.js       # Client-side multi-filter queries (searches, sorting, categories)
│   │   │   └── templateLoader.js     # Dynamically fetches and inserts HTML screen templates in parallel
│   │   ├── app.js                    # Orchestrator bootstrapping templates, routers, and observers
│   │   ├── calculator.js             # Financial aggregators for limits, OD, and spends
│   │   ├── categorizer.js            # Initial keyword rule matching and local AI post requests
│   │   ├── charts.js                 # Chart.js initialization for spend donut wheels
│   │   ├── config.js                 # Unified frontend configuration declaring API_BASE
│   │   ├── filters.js                # Interactive filter listeners (sort filters, search forms)
│   │   ├── metaStore.js              # State manager for account statement metadata local storage
│   │   ├── parser.js                 # Standard client-side JS CSV statement parser
│   │   ├── router.js                 # Navigation transitions and tab active selectors
│   │   ├── state.js                  # Reactive proxy store holding filtered states and registrations
│   │   ├── summary.js                # Formatter that populates stats lists and navbars
│   │   ├── table.js                  # Data-grid table for transaction logs
│   │   ├── trends.js                 # Multi-dataset trend line charts and forecast cards
│   │   └── ui.js                     # Global loader overlays and toast alerts
│   ├── templates/
│   │   ├── dashboard.html            # Core structural shell of the main analytical dashboard
│   │   ├── spend.html                # HTML component template for spend donuts and breakdowns
│   │   ├── table.html                # HTML component template for detailed tabular lists
│   │   ├── upload.html               # HTML component template for file drag and drop landing screen
│   │   └── vendors.html              # HTML component template for top merchants and subscriptions
│   └── index.html                    # Root entrypoint loading static resources and the app.js ES module
└── README.md                         # This file
```

---

## 4. Prerequisites

To run FinLens locally on your system, ensure the following dependencies are installed:

1.  **Node.js**: Version **v18.0.0** or higher is required.
2.  **Python 3**: Needed for legacy XLS statement parsing. Requires the `xlrd` library:
    ```bash
    pip install xlrd
    ```
3.  **Ollama**:
    *   Download and install the application from [Ollama's Official Website](https://ollama.com/).
    *   Pull the specific model required for vendor categorization:
        ```bash
        ollama pull qwen2.5:3b
        ```
    *   Ensure the Ollama service is running.

*(Note: MySQL is not used. FinLens uses SQLite, which is file-based and requires zero server configuration.)*

---

## 5. Local Setup

Follow these numbered steps to run the project locally on your machine:

1.  **Clone the Repository**:
    ```bash
    git clone <repository-url>
    cd FinLens
    ```

2.  **Install Backend Dependencies**:
    ```bash
    cd backend
    npm install
    ```

3.  **Configure Environment Variables**:
    Create an `.env` file in the `backend/` directory using the template below:
    ```env
    PORT=3000
    DB_PATH=./finlens.db
    OLLAMA_URL=http://localhost:11434
    ```

4.  **Start Ollama Server**:
    Ensure Ollama is running and hosting the local model:
    ```bash
    ollama serve
    ```

5.  **Start the Backend Server**:
    From inside the `backend/` directory, boot up the express server:
    ```bash
    node server.js
    ```
    *The console should print `FinLens AI server running on http://localhost:3000` and `SQLite initialized` on a successful run.*

6.  **Launch the Frontend**:
    Open the `frontend/index.html` file directly in a modern web browser, or serve the directory using a simple server of your choice:
    ```bash
    # Alternative: run a server inside the FinLens root directory
    npx serve frontend
    ```
    No bundlers or build steps are required.

---

## 6. How It Works

FinLens processes statement pipelines locally using the following data flow:

1.  **Upload Statement**: The user uploads an HDFC CSV or legacy XLS statement via the drag-and-drop panel.
2.  **Parsing & Deduplication**: The frontend calls the Javascript CSV parser or delegates legacy XLS binaries to the backend Python parser. During parsing, a unique **SHA-256 hash** is generated for each transaction using its normalized date, description, type, and amount. This hash is used for deduplication, ensuring that re-uploading the same statement is completely safe and does not create duplicate entries.
3.  **Initial Categorization**: The frontend executes a fast keyword-matching pass to identify obvious categories (e.g., swiggy -> food, zepto -> grocery). Any transaction that does not match a keyword is initially labeled as `other`.
4.  **Database Persistence**: Validated transactions are sent to the SQLite database. Spends are cataloged into vendor profiles.
5.  **Local AI Enrichment Queue**: Transactions labeled as `other` are automatically pushed to an in-memory queue in the backend. This queue slowly forwards the merchants to the local Ollama LLM (`qwen2.5:3b`) in the background. Ollama evaluates the vendor context and enriches its category, which is then written to the database.
6.  **Analytics Computation**: The dashboard polls the database and renders computed cashflow net balances, subscriptions, and spending cycles dynamically.

---

## 7. Key API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/transactions` | Persists a list of statement transactions and queues unknown categories. |
| **GET** | `/transactions` | Retrieves transactions (supports optional SQL filtering via `?accountId=`). |
| **POST** | `/parse-xls` | Receives binary XLS files and executes the Python extraction parsing. |
| **GET** | `/vendors` | Retrieves a list of categorized transaction aggregates grouped by vendor. |
| **GET** | `/vendors/top` | Retrieves top 10 merchants sorted by spend totals. |
| **GET** | `/vendors/:name` | Retrieves the profile database record of a single vendor. |
| **POST** | `/vendors/categorize` | Registers a manual category override and saves it to the cache and DB. |
| **GET** | `/subscriptions` | Slices spend transaction patterns to detect monthly recurring cycles. |
| **GET** | `/analytics/trends` | Compiles chronological category distributions and spending forecasts. |
| **GET** | `/metadata` | Retrieves account statement limits and dates. |
| **POST** | `/metadata` | Saves dynamic credit card statement limits or overdraft metadata. |
| **GET** | `/ai/status` | Exposes AI queue metadata: `{ queueLength, processing, circuitOpen }`. |
| **POST** | `/ai/status/reset` | Resets the circuit breaker and resumes Ollama queue processing. |

---

## 8. AI Enrichment & Circuit Breaker

### Local Intelligence Caching
To optimize performance and avoid making repeat LLM network calls, successful AI classifications are saved inside `backend/vendor-cache.json` and loaded into frontend `AppState.vendorCache` on startup. If a merchant has already been categorized by Ollama, subsequent matching transactions hit the cache instantly.

### In-Memory Queue & Circuit Breaker Protection
Because local LLM systems can be resource-heavy or occasionally offline, background AI enrichments are managed by a robust queuing system in `backend/aiQueue.js`.
*   If Ollama is unreachable, transactions are not lost; they are safely returned to the front of the queue.
*   The system tracks consecutive request errors. If Ollama fails **3 consecutive times**, the **circuit breaker opens** (`circuitOpen = true`) and queue execution is paused.
*   This protects server resources and informs the user. The frontend navbar displays an **"AI Paused"** amber alert.
*   Once Ollama is back online, the user can click **"Retry"** in the UI, or hit the `POST /ai/status/reset` endpoint, resetting the failure counter and resuming background categorizations.

---

## 9. .gitignore Notes

The project's `.gitignore` explicitly excludes:
*   `node_modules/` (dependency packages)
*   `*.db` (local statement databases)
*   `.env` (local configurations and ports)
*   `Statements/`, `*.csv`, `*.xls`, `*.xlsx` (raw bank statements)
*   `vendor-cache.json` (user-specific categorization caches)

*These files are excluded to protect the user's financial privacy and separate local data from the version-controlled codebase.*
