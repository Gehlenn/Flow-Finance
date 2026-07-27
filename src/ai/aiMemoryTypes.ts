export interface AIMemory {
  id: string;
  user_id: string;
  key: string;
  value: string;
  confidence: number;
  updated_at: string;
  metadata?: Record<string, unknown>;
}
