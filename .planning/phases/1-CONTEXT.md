# Phase 1 Context: AI Prediction Engine

## Research: Financial Prediction Methods

### Time Series Algorithms

**Exponential Smoothing (Selected)**
- Good for: Trend detection, seasonal patterns
- Complexity: Low
- Implementation: Custom or `simple-statistics`
- Pros: Fast, interpretable, handles gaps
- Cons: Less accurate than ML for complex patterns

**Moving Average with Confidence Bands**
- Simple rolling average ± standard deviation
- Good baseline for comparison
- Fast to compute

**Seasonal Decomposition (STL)**
- Separate trend, seasonality, residual
- Weekly patterns (weekend spending)
- Monthly patterns (salary cycles)

### Existing Transaction Data Structure

**Current Firestore Schema:**
```
/users/{userId}/transactions/{transactionId}
  - amount: number
  - category: string
  - date: timestamp
  - description: string
  - type: 'income' | 'expense'
  - isRecurring: boolean
```

**Data Volume Assumptions:**
- Active user: 100-300 transactions/month
- 2 years history: ~2400-7200 transactions
- Processing time target: < 100ms

### Similar Products (Reference)

**PocketGuard:**
- Shows "safe to spend" amount
- Simple income - bills - goals calculation
- No ML, rule-based

**YNAB:**
- Manual forecasting
- Category-based budgeting
- No AI predictions

**Copilot (Apple):**
- Spending forecasts
- Trend analysis
- Uses on-device ML

**Competitive Gap:**
- Most apps show past only
- Very few predict future cash flow
- Confidence intervals rarely shown

### Algorithm Selection Decision

**Chosen Approach: Hybrid**

**Layer 1: Recurring Detection (Rule-Based)**
- Identify recurring income (salary, freelance)
- Identify recurring expenses (rent, subscriptions)
- 95%+ accuracy, instant

**Layer 2: Trend Analysis (Exponential Smoothing)**
- Non-recurring income/expense patterns
- Weekly/monthly seasonality
- 60-80% accuracy

**Layer 3: Anomaly Detection (Statistical)**
- Flag unusual transactions
- Adjust predictions for outliers
- Improves accuracy by ~10%

### Firebase & Backend Architecture

**Current Setup:**
- Firestore: Transaction storage
- Firebase Auth: User management
- Cloud Functions: Available but minimal use
- Backend API: Express on Vercel

**Prediction Architecture:**
```
Scheduled Function (6 AM daily)
  ↓
Fetch active users
  ↓
For each user:
  - Load 90 days transactions
  - Run prediction algorithms
  - Store in /predictions/latest
  - Trigger alerts if needed
```

### Performance Considerations

**Computation Strategy:**
- Pre-compute daily (Cloud Function)
- Cache for 24 hours
- Real-time only on manual refresh

**Data Loading:**
- Index: `userId + date` composite
- Pagination: 90 days default
- Lazy load older data for trends

**Frontend:**
- PredictionChart extends existing Recharts
- SSR not needed (dynamic data)
- Skeleton loading state

### Accuracy Targets by Forecast Horizon

| Horizon | Target Accuracy | Use Case |
|---------|-----------------|----------|
| 7 days | 85% | Short-term planning |
| 14 days | 75% | Paycheck-to-paycheck |
| 30 days | 60% | Monthly budgeting |
| 90 days | 45% | Long-term trends only |

### Risk Factors to Model

**Income Risks:**
- Freelance irregularity
- Delayed payments
- Seasonal work

**Expense Risks:**
- Unexpected bills
- Emergency purchases
- One-time large expenses

**Confidence Calculation:**
```typescript
confidence = baseAccuracy 
  * incomeStabilityScore 
  * expensePredictabilityScore
  * dataVolumeFactor
```

### Files to Study

1. `src/pages/Dashboard.tsx` - Current chart implementation
2. `backend/src/routes/transactions.ts` - Data access patterns
3. `firebase.json` - Function configuration
4. `src/components/TransactionList.tsx` - Transaction structure

### Unknowns

1. How much historical data do users typically have?
2. What's the distribution of transaction categories?
3. How often do users check the dashboard?
4. What's acceptable prediction latency?

### Research Tasks

- [ ] Analyze sample transaction data distribution
- [ ] Test exponential smoothing with real data
- [ ] Measure Firestore query performance
- [ ] Review Recharts forecast examples
