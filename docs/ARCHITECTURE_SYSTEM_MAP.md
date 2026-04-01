# FLOW FINANCE - SYSTEM ARCHITECTURE MAP

## Layer 1 - Client Layer
- Web App (React)
- Mobile App (Capacitor)
- PWA

Responsibilities:
- UI rendering
- data visualization
- user input handling

## Layer 2 - Runtime Guard
- API Guard
- Chunk Guard
- ServiceWorker Guard
- Version Guard

Responsibilities:
- detect API offline
- recover broken chunks
- prevent inconsistent deploy states

## Layer 3 - API Layer
Primary endpoints:
- `/api/auth`
- `/api/accounts`
- `/api/transactions`
- `/api/ai`
- `/api/health`
- `/api/version`
- `/api/saas/usage`
- `/api/saas/billing-hooks`

Responsibilities:
- input entry
- validation
- authentication

## Layer 4 - User Context
- `UserContext`
  - `userId`
  - `accounts`
  - `currency`
  - `timezone`

Enables:
- multi-user
- multi-account

## Layer 5 - Domain Layer
Entities:
- User
- Account
- Transaction
- Goal
- Budget

Value Objects:
- Money
- Category
- Currency

## Layer 6 - Financial Engine
- `cashflowEngine`
- `forecastEngine`
- `budgetEngine`
- `financialHealthEngine`

Responsibilities:
- balance calculations
- forecasting
- spending analysis

## Layer 7 - AI Engine
- `aiOrchestrator`
- `aiContextBuilder`
- `aiDecisionEngine`

Responsibilities:
- insights generation
- financial analysis
- recommendations

## Layer 8 - Autopilot Engine
Responsibilities:
- overspending detection
- financial health analysis
- alert generation

## Layer 9 - AI CFO Agent
Components:
- `AICFOAgent`
- `CFOPlanner`
- `CFOAdvisor`

Responsibilities:
- financial planning
- savings strategies
- simulation guidance

## Layer 10 - Event Bus
Events:
- `transaction_created`
- `transaction_deleted`
- `goal_created`
- `budget_changed`
- `ai_task_completed`

Enables:
- automation
- reactivity
- cross-module integration

## Layer 11 - AI Task Queue
Task types:
- `INSIGHT_GENERATION`
- `AUTOPILOT_ANALYSIS`
- `REPORT_GENERATION`
- `CASHFLOW_SIMULATION`

Goal:
- avoid UI/main-thread blocking

## Layer 12 - Repository Layer
- `transactionRepository`
- `accountRepository`
- `goalRepository`
- `aiMemoryRepository`

Rule:
- engines must not read/write database directly

## Layer 13 - Database Layer
Current:
- Firebase

Future:
- PostgreSQL
- Supabase

## Visual Summary
Client
 |
Runtime Guard
 |
Frontend
 |
API
 |
User Context
 |
Domain
 |
Financial Engines
 |
AI Engines
 |
Autopilot
 |
AI CFO Agent
 |
Event Bus
 |
AI Queue
 |
Repositories
 |
Database
