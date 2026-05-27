export type AICFOConfidenceBand = 'low' | 'medium' | 'high';

export interface AICFOExplainability {
  reasons_used: string[];
  evidence: {
    confirmed_cash?: string;
    forecast_30d?: string;
    month_result?: string;
    data_quality_note?: string;
    base_sufficiency: 'strong' | 'limited';
  };
  confidence_band: AICFOConfidenceBand;
}

export type CFOIntent =
  | 'spending_advice'
  | 'cash_position'
  | 'risk_question'
  | 'savings_question'
  | 'monthly_summary'
  | 'receivables_question';

export interface AICFOResponse {
  explainability: AICFOExplainability;
  question: string;
  answer: string;
  context_summary?: string;
  intent?: CFOIntent;
  response_depth?: 'standard' | 'reduced';
  timestamp: string;
  diagnostic?: {
    kind: 'ai_unavailable';
    message: string;
    suggestion?: string;
  };
}
