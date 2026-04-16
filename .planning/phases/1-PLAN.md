# Phase 1: AI Prediction Engine

## Goal
Implement AI-powered cash flow predictions using historical transaction data to forecast future balances, identify potential shortfalls, and suggest optimal payment timing.

## Context from v0.9.6
Flow Finance is a functional cash flow management SaaS with:
- Transaction entry and categorization
- Dashboard with basic charts (Recharts)
- Firebase backend
- React + TypeScript + Vite frontend
- Mobile responsive design

Current gap: No predictive capabilities - users can only see historical data, not future projections.

## Deliverables

### 1. PredictionEngine Service
**Location:** `backend/src/services/PredictionEngine.ts`

**Responsibilities:**
- Analyze historical transaction patterns
- Generate cash flow forecasts
- Detect anomalies and trends
- Calculate confidence scores

**Key Methods:**
```typescript
class PredictionEngine {
  async predictCashFlow(
    userId: string,
    days: number = 30
  ): Promise<CashFlowPrediction> {
    // ML-based prediction using transaction history
  }
  
  async detectSeasonality(
    transactions: Transaction[]
  ): Promise<SeasonalPattern[]> {
    // Identify recurring patterns
  }
  
  async predictShortfall(
    userId: string
  ): Promise<ShortfallRisk | null> {
    // Warn about potential negative balances
  }
}
```

### 2. Prediction Data Models
**Location:** `shared/types/prediction.ts`

```typescript
interface CashFlowPrediction {
  dateRange: { start: Date; end: Date };
  dailyPredictions: DailyPrediction[];
  confidence: number; // 0-1
  trend: 'up' | 'down' | 'stable';
  factors: PredictionFactor[];
}

interface DailyPrediction {
  date: Date;
  predictedBalance: number;
  confidenceInterval: { min: number; max: number };
  expectedIncome: number;
  expectedExpenses: number;
}

interface ShortfallRisk {
  predictedDate: Date;
  severity: 'low' | 'medium' | 'high';
  projectedDeficit: number;
  suggestions: string[];
}
```

### 3. ML Algorithm Selection

**Primary: Time Series Analysis**
- Exponential smoothing for trend detection
- Seasonal decomposition (weekly/monthly patterns)
- Moving averages with confidence bands

**Secondary: Pattern Recognition**
- Recurring transaction detection
- Category-based spending patterns
- Income predictability scoring

**Implementation:**
- Use `simple-statistics` or custom algorithms (no heavy ML deps)
- Keep calculations lightweight (< 100ms for 2 years of data)
- Cache predictions for 1 hour

### 4. API Endpoints
**Location:** `backend/src/routes/predictions.ts`

```typescript
// GET /api/predictions/cash-flow?days=30
// Returns CashFlowPrediction for authenticated user

// GET /api/predictions/shortfall-risk
// Returns ShortfallRisk if detected, null otherwise

// GET /api/predictions/seasonality
// Returns identified seasonal patterns
```

### 5. Frontend Integration

**New Component:** `src/components/PredictionChart.tsx`
- Extends existing Recharts setup
- Shows predicted vs actual cash flow
- Confidence bands as shaded area
- Interactive tooltip with predictions

**Dashboard Updates:**
- Add "30-Day Forecast" card
- Show predicted ending balance
- Display trend indicator (📈 📉 ➡️)

**Alerts System:**
- New notification type: `SHORTFALL_WARNING`
- Toast when risk level changes
- Email digest option for high risks

### 6. Firebase Integration

**Firestore Schema Extension:**
```
/users/{userId}/predictions/latest
/users/{userId}/predictions/history/{date}
```

**Cloud Function:**
- Daily scheduled run at 6 AM
- Recalculates predictions for all active users
- Triggers alerts if new risks detected

## Success Criteria

1. Predictions generate within 100ms
2. 80%+ accuracy for 7-day forecasts
3. 60%+ accuracy for 30-day forecasts
4. Shortfall warnings delivered 3+ days in advance
5. UI renders predictions without flickering
6. Mobile-responsive prediction charts

## Dependencies
- Existing transaction data in Firestore
- Recharts (already installed)
- Firebase Functions (setup needed)
- Backend API structure (exists)

## Estimation
- Algorithm design: 2 hours
- Backend implementation: 3 hours
- Frontend components: 2 hours
- Testing/tuning: 2 hours
- **Total: 9 hours**

## Files to Create/Modify

**New:**
1. `backend/src/services/PredictionEngine.ts`
2. `backend/src/routes/predictions.ts`
3. `shared/types/prediction.ts`
4. `src/components/PredictionChart.tsx`
5. `src/hooks/usePredictions.ts`

**Modify:**
6. `src/pages/Dashboard.tsx` - Add forecast section
7. `backend/src/index.ts` - Add prediction routes
8. `firebase.json` - Add scheduled function
9. `src/components/AlertToast.tsx` - Add shortfall alerts

## Risk Mitigation

- **Risk:** Insufficient historical data for new users
  - **Mitigation:** Graceful fallback to manual estimates, "Need 30 days of data" message
  
- **Risk:** Prediction accuracy too low
  - **Mitigation:** Show confidence intervals prominently, never hide uncertainty
  
- **Risk:** Calculation performance issues
  - **Mitigation:** Pre-compute in Cloud Function, cache aggressively

## Privacy Considerations
- All ML processing server-side
- No transaction data leaves Firebase
- User can disable predictions in settings

## Verification Checklist
- [ ] API returns predictions for test user
- [ ] Chart renders with confidence bands
- [ ] Shortfall alert triggers correctly
- [ ] Mobile view shows compressed chart
- [ ] Cloud Function runs daily
- [ ] Cache invalidation works
- [ ] New users see helpful onboarding message
- [ ] 60 FPS maintained on dashboard
