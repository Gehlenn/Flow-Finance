/**
 * Serviço de detecção de assinaturas em transações
 * Roadmap: v0.8.x
 *
 * - Detecta serviços como Netflix, Spotify, Amazon, etc
 * - Usa IA e heurísticas de recorrência/merchant
 * - Integra com pipeline de transações
 */

import { Transaction } from '../../../shared/types';

export interface SubscriptionDetection {
  assinatura: string | null;
  confidence: number;
  rationale?: string;
  erro?: string;
}

export async function detectarAssinatura(transacao: Partial<Transaction>): Promise<SubscriptionDetection> {
  // TODO: Integrar IA/heurística para detecção de assinatura
  return {
    assinatura: null,
    confidence: 0,
    rationale: '',
    erro: 'Detector de assinatura não implementado'
  };
}
