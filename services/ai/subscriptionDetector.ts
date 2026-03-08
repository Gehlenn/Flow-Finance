/**
 * SUBSCRIPTION DETECTOR — src/services/ai/subscriptionDetector.ts
 *
 * PART 4 — Detecta assinaturas e pagamentos recorrentes nas transações.
 *
 * Estratégias de detecção:
 *   1. Matching por catálogo de serviços conhecidos (Netflix, Spotify, etc.)
 *   2. Detecção de padrões temporais — mesmo valor, intervalo regular (~30d/7d)
 *   3. Heurística de "small recurring" — pagamentos pequenos mensais sem variação
 */

import { Transaction, TransactionType } from '../../types';
import { makeId } from '../../utils/helpers';


// ─── Models ───────────────────────────────────────────────────────────────────

export type SubscriptionBillingCycle = 'monthly' | 'weekly' | 'annual' | 'unknown';

export interface DetectedSubscription {
  id:            string;
  name:          string;           // Nome normalizado (ex: "Netflix")
  merchant:      string;           // Nome como aparece nas transações
  amount:        number;           // Valor típico da cobrança
  cycle:         SubscriptionBillingCycle;
  last_charge:   string;           // ISO date da cobrança mais recente
  next_expected: string | null;    // Estimativa da próxima cobrança
  occurrences:   number;          // Quantas vezes foi detectado
  total_spent:   number;          // Total gasto até hoje
  category:      string;          // Categoria sugerida
  logo:          string;          // emoji logo
  confidence:    number;          // 0–1
  transactions:  Transaction[];   // Transações relacionadas
}

export interface SubscriptionSummary {
  subscriptions:    DetectedSubscription[];
  total_monthly:    number;   // Custo mensal estimado
  total_annual:     number;   // Projeção anual
  count:            number;
  highest_cost:     DetectedSubscription | null;
  categories:       Record<string, number>;  // categoria → total mensal
}

// ─── Known subscription catalog ───────────────────────────────────────────────

interface KnownService {
  name:     string;
  keywords: string[];        // fragments to match in description/merchant
  category: string;
  logo:     string;
  typical_range?: [number, number]; // [min, max] expected value
}

const KNOWN_SERVICES: KnownService[] = [
  // Streaming de vídeo
  { name: 'Netflix',        keywords: ['netflix'],                     category: 'Entretenimento', logo: '🎬', typical_range: [20, 60]  },
  { name: 'Disney+',        keywords: ['disney', 'disney+'],           category: 'Entretenimento', logo: '🏰', typical_range: [15, 40]  },
  { name: 'HBO Max',        keywords: ['hbo', 'max', 'warner'],        category: 'Entretenimento', logo: '📺', typical_range: [20, 50]  },
  { name: 'Amazon Prime',   keywords: ['amazon prime', 'prime video'], category: 'Entretenimento', logo: '📦', typical_range: [10, 30]  },
  { name: 'Globoplay',      keywords: ['globoplay', 'globo play'],      category: 'Entretenimento', logo: '🌐', typical_range: [15, 40]  },
  { name: 'Paramount+',     keywords: ['paramount'],                    category: 'Entretenimento', logo: '🎭', typical_range: [15, 35]  },
  { name: 'Apple TV+',      keywords: ['apple tv'],                     category: 'Entretenimento', logo: '🍎', typical_range: [20, 40]  },

  // Streaming de música
  { name: 'Spotify',        keywords: ['spotify'],                     category: 'Entretenimento', logo: '🎵', typical_range: [10, 30]  },
  { name: 'Apple Music',    keywords: ['apple music', 'itunes'],       category: 'Entretenimento', logo: '🎶', typical_range: [10, 30]  },
  { name: 'Deezer',         keywords: ['deezer'],                      category: 'Entretenimento', logo: '🎧', typical_range: [10, 25]  },
  { name: 'YouTube Music',  keywords: ['youtube', 'youtube premium'],  category: 'Entretenimento', logo: '▶️', typical_range: [15, 35]  },

  // Cloud / Produtividade
  { name: 'Google One',     keywords: ['google one', 'google storage'], category: 'Tecnologia', logo: '☁️', typical_range: [5, 40]   },
  { name: 'iCloud',         keywords: ['icloud', 'apple icloud'],      category: 'Tecnologia', logo: '🍎', typical_range: [5, 35]   },
  { name: 'Microsoft 365',  keywords: ['microsoft 365', 'office 365', 'ms office'], category: 'Tecnologia', logo: '💻', typical_range: [20, 70] },
  { name: 'Dropbox',        keywords: ['dropbox'],                     category: 'Tecnologia', logo: '📂', typical_range: [10, 50]  },
  { name: 'Adobe CC',       keywords: ['adobe', 'creative cloud'],     category: 'Tecnologia', logo: '🎨', typical_range: [50, 300] },
  { name: 'Notion',         keywords: ['notion'],                      category: 'Tecnologia', logo: '📝', typical_range: [10, 50]  },
  { name: 'Canva',          keywords: ['canva'],                       category: 'Tecnologia', logo: '🖼️', typical_range: [10, 80]  },

  // Saúde e fitness
  { name: 'Smart Fit',      keywords: ['smart fit', 'smartfit'],       category: 'Saúde', logo: '💪', typical_range: [50, 120] },
  { name: 'Gympass',        keywords: ['gympass', 'wellhub'],          category: 'Saúde', logo: '🏋️', typical_range: [50, 200] },
  { name: 'Headspace',      keywords: ['headspace'],                   category: 'Saúde', logo: '🧘', typical_range: [20, 50]  },
  { name: 'Calm',           keywords: ['calm'],                        category: 'Saúde', logo: '🌿', typical_range: [20, 50]  },

  // Delivery e alimentação
  { name: 'iFood',          keywords: ['ifood'],                       category: 'Alimentação', logo: '🍔', typical_range: [20, 50]  },
  { name: 'Rappi Turbo',    keywords: ['rappi turbo', 'rappiturbo'],   category: 'Alimentação', logo: '🛵', typical_range: [10, 30]  },

  // Notícias e conteúdo
  { name: 'New York Times', keywords: ['nytimes', 'new york times'],   category: 'Informação', logo: '📰', typical_range: [10, 40]  },
  { name: 'Medium',         keywords: ['medium.com', 'medium'],       category: 'Informação', logo: '✍️', typical_range: [10, 30]  },

  // Telecomunicações
  { name: 'Claro',          keywords: ['claro'],                       category: 'Telecomunicações', logo: '📱', typical_range: [30, 200] },
  { name: 'Vivo',           keywords: ['vivo'],                        category: 'Telecomunicações', logo: '📡', typical_range: [30, 200] },
  { name: 'TIM',            keywords: ['tim'],                         category: 'Telecomunicações', logo: '📶', typical_range: [30, 200] },
  { name: 'NET/Claro',      keywords: ['net ', 'net internet'],        category: 'Telecomunicações', logo: '🌐', typical_range: [80, 250] },

  // Seguros
  { name: 'Sulamerica',     keywords: ['sulamerica', 'sul america'],   category: 'Seguros', logo: '🛡️', typical_range: [50, 500] },
  { name: 'Bradesco Saúde', keywords: ['bradesco saude', 'bradesco saúde'], category: 'Seguros', logo: '🏥', typical_range: [100, 800] },
  { name: 'Unimed',         keywords: ['unimed'],                      category: 'Seguros', logo: '⚕️', typical_range: [100, 800] },
  { name: 'Amil',           keywords: ['amil'],                        category: 'Seguros', logo: '🩺', typical_range: [100, 800] },

  // Outros
  { name: 'LinkedIn Premium', keywords: ['linkedin'],                  category: 'Carreira', logo: '💼', typical_range: [30, 150] },
  { name: 'Coursera',       keywords: ['coursera'],                    category: 'Educação', logo: '🎓', typical_range: [20, 200] },
  { name: 'Duolingo Plus',  keywords: ['duolingo'],                    category: 'Educação', logo: '🦉', typical_range: [10, 30]  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────


function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function estimateNextCharge(lastDate: string, cycle: SubscriptionBillingCycle): string | null {
  const d = new Date(lastDate);
  if (isNaN(d.getTime())) return null;
  if (cycle === 'monthly')  d.setMonth(d.getMonth() + 1);
  else if (cycle === 'weekly') d.setDate(d.getDate() + 7);
  else if (cycle === 'annual') d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d.toISOString();
}

function detectCycle(transactions: Transaction[]): SubscriptionBillingCycle {
  if (transactions.length < 2) return 'unknown';
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = (new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime()) / 86400000;
    gaps.push(diffDays);
  }
  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

  if (avgGap >= 25 && avgGap <= 35) return 'monthly';
  if (avgGap >= 5  && avgGap <= 10) return 'weekly';
  if (avgGap >= 350 && avgGap <= 380) return 'annual';
  return 'unknown';
}

function txMatchesService(tx: Transaction, service: KnownService): boolean {
  const desc = normalizeText(tx.description ?? '');
  const merch = normalizeText(tx.merchant ?? '');
  return service.keywords.some(kw => desc.includes(kw) || merch.includes(kw));
}

// ─── PART 4 — detectSubscriptions ────────────────────────────────────────────

/**
 * Detecta assinaturas e pagamentos recorrentes nas transações.
 *
 * @param transactions - lista completa de transações do usuário
 * @returns SubscriptionSummary com lista detalhada de assinaturas encontradas
 */
export function detectSubscriptions(transactions: Transaction[]): SubscriptionSummary {
  const expenses = transactions.filter(
    t => t.type === TransactionType.DESPESA && !t.generated
  );

  const results: DetectedSubscription[] = [];
  const matchedTxIds = new Set<string>();

  // ── Strategy 1: Known service catalog ─────────────────────────────────────
  for (const service of KNOWN_SERVICES) {
    const matching = expenses.filter(tx => txMatchesService(tx, service));
    if (matching.length === 0) continue;

    const sorted = [...matching].sort((a, b) => b.date.localeCompare(a.date));
    const amounts = matching.map(t => t.amount);
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const cycle = detectCycle(matching);

    // Confidence: higher for known services + multiple occurrences
    let confidence = 0.7;
    if (matching.length >= 2) confidence += 0.15;
    if (matching.length >= 3) confidence += 0.10;
    if (cycle !== 'unknown')  confidence += 0.05;
    confidence = Math.min(1, confidence);

    matching.forEach(t => matchedTxIds.add(t.id));

    results.push({
      id:            makeId(),
      name:          service.name,
      merchant:      sorted[0].merchant ?? sorted[0].description,
      amount:        Math.round(avgAmount * 100) / 100,
      cycle,
      last_charge:   sorted[0].date,
      next_expected: estimateNextCharge(sorted[0].date, cycle),
      occurrences:   matching.length,
      total_spent:   amounts.reduce((s, a) => s + a, 0),
      category:      service.category,
      logo:          service.logo,
      confidence,
      transactions:  sorted,
    });
  }

  // ── Strategy 2: Pattern-based detection (unknown recurring payments) ───────
  // Group unmatched expenses by normalised description similarity
  const unmatched = expenses.filter(t => !matchedTxIds.has(t.id));
  const groups: Record<string, Transaction[]> = {};

  for (const tx of unmatched) {
    // Usar o 'merchant' normalizado como chave principal, que é mais estável.
    // Usar o 'fingerprint' da descrição como fallback.
    const key = normalizeText(tx.merchant || '') || normalizeText(tx.description ?? '')
      .replace(/\d+/g, '#')
      .slice(0, 20)
      .trim();
      
    if (!key || key.length < 3) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }

  for (const [key, txs] of Object.entries(groups)) {
    if (txs.length < 2) continue; // need at least 2 occurrences

    const amounts = txs.map(t => t.amount);
    const avgAmt = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const maxDeviation = Math.max(...amounts.map(a => Math.abs(a - avgAmt)));

    // Only flag as subscription if values are stable (< 15% deviation)
    if (maxDeviation / avgAmt > 0.15) continue;

    const cycle = detectCycle(txs);
    if (cycle === 'unknown') continue; // must have a recognisable pattern

    const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
    const name = (sorted[0].merchant ?? sorted[0].description).slice(0, 40);

    let confidence = 0.5;
    if (txs.length >= 3) confidence += 0.15;
    if (maxDeviation === 0) confidence += 0.15; // exact same value every time
    // cycle is guaranteed not to be 'unknown' here due to guard above; skip redundant check


    results.push({
      id:            makeId(),
      name,
      merchant:      name,
      amount:        Math.round(avgAmt * 100) / 100,
      cycle,
      last_charge:   sorted[0].date,
      next_expected: estimateNextCharge(sorted[0].date, cycle),
      occurrences:   txs.length,
      total_spent:   amounts.reduce((s, a) => s + a, 0),
      category:      'Assinatura',
      logo:          '🔄',
      confidence,
      transactions:  sorted,
    });
  }

  // ── Sort by amount desc ────────────────────────────────────────────────────
  results.sort((a, b) => b.amount - a.amount);

  // ── Summary ───────────────────────────────────────────────────────────────
  const toMonthly = (sub: DetectedSubscription): number => {
    if (sub.cycle === 'monthly')  return sub.amount;
    if (sub.cycle === 'weekly')   return sub.amount * 4.33;
    if (sub.cycle === 'annual')   return sub.amount / 12;
    return sub.amount; // assume monthly if unknown
  };

  const total_monthly = results.reduce((s, sub) => s + toMonthly(sub), 0);
  const total_annual  = total_monthly * 12;

  const categories: Record<string, number> = {};
  for (const sub of results) {
    categories[sub.category] = (categories[sub.category] ?? 0) + toMonthly(sub);
  }

  return {
    subscriptions: results,
    total_monthly:  Math.round(total_monthly * 100) / 100,
    total_annual:   Math.round(total_annual * 100) / 100,
    count:          results.length,
    highest_cost:   results[0] ?? null,
    categories,
  };
}

// ─── Utility exports ──────────────────────────────────────────────────────────

/** Format next charge date in a human-readable way */
export function formatNextCharge(iso: string | null): string {
  if (!iso) return 'Indeterminado';
  const d = new Date(iso);
  const diffDays = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diffDays < 0)  return 'Atrasado';
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays < 7)   return `Em ${diffDays} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/** Cycle label in Portuguese */
export function formatCycle(cycle: SubscriptionBillingCycle): string {
  const labels: Record<SubscriptionBillingCycle, string> = {
    monthly: 'Mensal',
    weekly:  'Semanal',
    annual:  'Anual',
    unknown: 'Recorrente',
  };
  return labels[cycle];
}
