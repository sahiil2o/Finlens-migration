# FinLens — Project Tracking & Architecture Document

## Project Overview

FinLens is a local-first AI-powered finance intelligence platform built to:
- parse bank/credit card statements
- categorize transactions
- persist financial history locally
- provide behavioral spend analytics
- detect recurring subscriptions
- generate intelligent financial insights

The architecture is designed around:
- local privacy
- state-driven frontend rendering
- extensible analytics pipelines
- AI enrichment workflows

---

# Current Development Status

## Current Phase
**Phase 10 — AI Finance Assistant**

### Status
- Backend: Stable
- Frontend: Stable
- Subscription UI: Complete
- Forecasting Engine: Complete
- AI Assistant Chatbot: In Progress

### Completed
- CSV ingestion
- HDFC parser
- SQLite persistence
- Deduplication via transaction hashes
- AI categorization queue
- Vendor analytics
- Polling synchronization
- Recurring subscription detection
- Dashboard analytics
- Timeline charts
- Vendor intelligence APIs
- Subscription Intelligence UI
- Recurring spend insights
- Confidence-based recurring detection rendering
- Budget forecasting
- Monthly trend analytics
- Cashflow insights
- Predictive weighted moving average spend forecast

### In Progress
- AI finance assistant chatbot interface
- LLM conversational queries on transaction history

### Next Planned Features
- Multi-bank support
- Multi-statement comparisons

---

# Milestone Timeline

| Phase | Feature | Status |
|---|---|---|
| Phase 1 | CSV Parsing | ✅ Complete |
| Phase 2 | Categorization Engine | ✅ Complete |
| Phase 3 | SQLite Persistence | ✅ Complete |
| Phase 4 | Dashboard Analytics | ✅ Complete |
| Phase 5 | Vendor Intelligence | ✅ Complete |
| Phase 6 | Polling Sync Architecture | ✅ Complete |
| Phase 7 | Subscription Detection API | ✅ Complete |
| Phase 8 | Subscription Intelligence UI | ✅ Complete |
| Phase 9 | Forecasting & Trend Analytics | ✅ Complete |
| Phase 10 | AI Finance Assistant | 🔄 In Progress |

---

# Stability Status

## Frontend Stability
Stable

## Backend Stability
Stable

## Database Stability
Stable after schema reset and absolute path fixes

## Known Unstable Areas
- recurring false positives
- AI categorization confidence quality
- polling scalability for larger datasets
- edge-case CSV parsing

---

# Current Tech Stack

## Frontend
- Vanilla JavaScript
- HTML5
- CSS3
- Chart.js

## Backend
- Node.js
- Express.js
- SQLite3

## AI Layer
- Local categorization pipeline
- Async enrichment queue
- Heuristic vendor intelligence

---

# Current Architecture

## Data Flow

```txt
CSV
↓
Parser
↓
Categorizer
↓
SQLite
↓
Polling APIs
↓
AppState
↓
UI
```

## Frontend State Flow

```txt
transactions
↓
filters
↓
filteredTransactions
↓
table
charts
summary
analytics
```

---

# Completed Features

## Core Features
- CSV ingestion
- HDFC statement parser
- transaction normalization
- transaction deduplication

## Persistence
- SQLite persistence
- transaction hashing
- absolute DB path handling
- schema-driven initialization

## Analytics
- category analytics
- timeline analytics
- vendor analytics
- recurring subscription detection
- utilization analytics

## AI Features
- async AI enrichment queue
- categorization pipeline
- enrichment status rendering

## UI Features
- charts
- transaction table
- vendor leaderboard
- summary analytics
- filtering system
- polling-based updates

---

# Database Schema

## transactions table

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER | Primary key |
| transaction_hash | TEXT | Deduplication |
| date | TEXT | Transaction date |
| merchant | TEXT | Original description |
| normalized_merchant | TEXT | Clean vendor identity |
| amount | REAL | Transaction amount |
| type | TEXT | credit/debit |
| category | TEXT | Categorization |
| ai_categorized | INTEGER | AI enrichment state |
| source_bank | TEXT | Bank source |
| statement_date | TEXT | Statement metadata |

## vendors table

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER | Primary key |
| normalized_name | TEXT | Unique vendor identity |
| display_name | TEXT | Original display name |
| category | TEXT | Vendor category |
| transaction_count | INTEGER | Frequency |
| total_spend | REAL | Behavioral spend |
| first_seen | TEXT | First transaction |
| last_seen | TEXT | Latest transaction |

---

# API Endpoints

## Transactions
- GET /transactions
- POST /transactions

## Vendors
- GET /vendors
- GET /vendors/top
- GET /vendors/:name

## AI
- POST /categorize

## Intelligence
- GET /subscriptions

---

# Frontend Modules

| File | Responsibility |
|---|---|
| app.js | Application orchestration |
| state.js | Centralized state |
| parser.js | CSV parsing |
| categorizer.js | Transaction categorization |
| filters.js | Derived state filtering |
| charts.js | Analytics charts |
| summary.js | Summary calculations |
| table.js | Transaction rendering |
| ui.js | UI utilities |

---

# Important Architectural Decisions

- SQLite is the source of truth
- Frontend is state-driven
- Polling is used instead of websockets
- Vendor analytics exclude repayments
- Subscription detection uses heuristics
- AI enrichment is asynchronous
- Vendor intelligence tracks behavioral spend only

---

# Debugging Notes

## Major Issues Resolved
- duplicate database creation
- relative path DB issues
- schema mismatch problems
- merchant column mismatch
- polling reset issues
- chart rendering instability
- filter synchronization issues

## Important Lessons
- DB should always be source of truth
- filteredTransactions must drive analytics
- repayment transactions must be excluded from spend intelligence

---

# Setup Instructions

## Backend

```bash
cd backend
npm install
node server.js
```

## Frontend
Open frontend/index.html via Live Server.

## Database Reset

Delete:
```txt
backend/finlens.db
```

Then restart backend.

---

# Known Future Enhancements

## Intelligence
- anomaly detection
- forecasting
- budget recommendations
- financial health scoring

## UX
- mobile responsiveness
- statement comparison
- dark/light themes
- export support

## AI
- conversational finance assistant
- personalized insights
- vendor learning
- confidence scoring improvements

---

# Security & Privacy Notes

- local-first architecture
- no cloud transaction storage
- SQLite-based local persistence
- future local AI roadmap

---

# Parsing Rules

## Current Support
- HDFC CSV statements

## Planned Support
- ICICI
- Axis
- SBI
- multi-bank normalization

---

# Performance Notes

- polling interval: 5 seconds
- Chart.js rendering currently acceptable
- future DB indexing recommended for scale

---

# Current Project State Summary

FinLens has evolved from:
```txt
statement visualizer
```

into:
```txt
local-first finance intelligence platform
```

Current architecture maturity:
- stable persistence layer
- stable frontend state architecture
- intelligent analytics pipeline
- recurring detection engine
- vendor intelligence framework

