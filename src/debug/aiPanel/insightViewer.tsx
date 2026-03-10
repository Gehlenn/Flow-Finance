import React from 'react';
import { getLastInsights } from '../../engines/ai/aiOrchestrator';

export function InsightViewer() {
  const insights = getLastInsights();

  const profiles = insights.map((i) => ({
    userId: i.userId,
    profile: i.profile.profile,
    savingsRate: i.profile.savingsRate,
  }));

  const autopilotDecisions = insights.map((i) => ({
    userId: i.userId,
    level: i.decision.level,
    recommendation: i.decision.recommendation,
  }));

  const cashflowForecasts = insights.map((i) => ({
    userId: i.userId,
    in7Days: i.cashflowForecast.in7Days,
    in30Days: i.cashflowForecast.in30Days,
    in90Days: i.cashflowForecast.in90Days,
  }));

  return (
    <section>
      <h2>AI Insights</h2>
      <pre>{JSON.stringify(insights, null, 2)}</pre>

      <h2>Financial Profile</h2>
      <pre>{JSON.stringify(profiles, null, 2)}</pre>

      <h2>Autopilot Decisions</h2>
      <pre>{JSON.stringify(autopilotDecisions, null, 2)}</pre>

      <h2>Cashflow Forecast</h2>
      <pre>{JSON.stringify(cashflowForecasts, null, 2)}</pre>
    </section>
  );
}
