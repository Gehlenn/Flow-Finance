/**
 * BANK PROVIDER INTERFACE + MOCK IMPLEMENTATION
 *
 * PART 10 — Interface provider abstrata.
 * Qualquer API futura (Pluggy, Belvo, TrueLayer) deve implementar IBankProvider.
 *
 * Estrutura de providers:
 *
 *   IBankProvider (interface)
 *       ├── MockBankProvider       ← implementação atual (simulada)
 *       ├── PluggyProvider         ← futuro: npx @pluggy/client
 *       ├── BelvoProvider          ← futuro: @belvo-finance/belvo-js
 *       └── TrueLayerProvider      ← futuro: @truelayer/client
 */

import { Transaction, TransactionType, Category } from '../../types';

// ─── PART 10 — Provider interface (contrato para futuros providers) ────────────

export interface RawBankTransaction {
  id: string;
  date: string;           // ISO 8601
  amount: number;         // positivo = crédito, negativo = débito
  description: string;
  merchant?: string;
  category_hint?: string; // categoria sugerida pelo banco
  balance_after?: number; // saldo após a transação
}

export interface RawBankAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
}

export interface IBankProvider {
  /** Nome do provedor (usado para logs e UI) */
  readonly providerName: string;

  /** Conectar banco e retornar token/ID de conexão externo */
  connect(bankId: string, userId: string): Promise<{ external_id: string }>;

  /** Revogar acesso */
  disconnect(externalId: string): Promise<void>;

  /** Buscar contas vinculadas */
  fetchAccounts(externalId: string): Promise<RawBankAccount[]>;

  /** Buscar transações (últimos N dias) */
  fetchTransactions(externalId: string, days?: number): Promise<RawBankTransaction[]>;
}

// ─── PART 3 — Mock Bank Provider ─────────────────────────────────────────────

// Dados mock realistas por banco
const BANK_MOCK_DATA: Record<string, {
  balance: number;
  transactions: Omit<RawBankTransaction, 'id'>[];
}> = {
  default: {
    balance: 4280.50,
    transactions: [
      { date: offset(-1),  amount: -89.90,  description: 'iFood',          merchant: 'iFood',           category_hint: 'food' },
      { date: offset(-2),  amount: -45.00,  description: 'Uber',           merchant: 'Uber',            category_hint: 'transport' },
      { date: offset(-3),  amount: 3200.00, description: 'Salário',        merchant: 'Empresa S.A.',    category_hint: 'salary' },
      { date: offset(-4),  amount: -220.00, description: 'Supermercado Pão de Açúcar', merchant: 'Pão de Açúcar', category_hint: 'supermarket' },
      { date: offset(-5),  amount: -65.00,  description: 'Netflix',        merchant: 'Netflix',         category_hint: 'subscription' },
      { date: offset(-6),  amount: -38.50,  description: 'Spotify',        merchant: 'Spotify',         category_hint: 'subscription' },
      { date: offset(-7),  amount: -120.00, description: 'Farmácia Droga Raia', merchant: 'Droga Raia', category_hint: 'health' },
      { date: offset(-8),  amount: -55.00,  description: 'Restaurante Madero', merchant: 'Madero',      category_hint: 'food' },
      { date: offset(-10), amount: -180.00, description: 'Conta de Luz CEMIG', merchant: 'CEMIG',       category_hint: 'utilities' },
      { date: offset(-12), amount: -95.00,  description: 'Academia Smart Fit', merchant: 'Smart Fit',  category_hint: 'health' },
      { date: offset(-14), amount: 850.00,  description: 'Freelance Design', merchant: 'Cliente XYZ',  category_hint: 'income' },
      { date: offset(-15), amount: -320.00, description: 'Compras Amazon', merchant: 'Amazon',          category_hint: 'shopping' },
      { date: offset(-18), amount: -42.00,  description: 'Uber Eats',      merchant: 'Uber Eats',       category_hint: 'food' },
      { date: offset(-20), amount: -1200.00,description: 'Aluguel',        merchant: 'Imobiliária',     category_hint: 'housing' },
      { date: offset(-22), amount: -75.00,  description: 'Posto Shell',    merchant: 'Shell',           category_hint: 'transport' },
      { date: offset(-25), amount: 450.00,  description: 'Pix Recebido',   merchant: 'João Silva',      category_hint: 'income' },
      { date: offset(-28), amount: -88.00,  description: 'Rappi',          merchant: 'Rappi',           category_hint: 'food' },
      { date: offset(-30), amount: 3200.00, description: 'Salário',        merchant: 'Empresa S.A.',    category_hint: 'salary' },
    ],
  },
};

function offset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export class MockBankProvider implements IBankProvider {
  readonly providerName = 'Mock (Simulado)';

  async connect(bankId: string, _userId: string) {
    // Simula latência de rede
    await delay(600);
    return { external_id: `mock_${bankId}_${Math.random().toString(36).slice(2, 8)}` };
  }

  async disconnect(_externalId: string) {
    await delay(300);
  }

  async fetchAccounts(externalId: string): Promise<RawBankAccount[]> {
    await delay(400);
    const bankId = externalId.split('_')[1] ?? 'default';
    const data = BANK_MOCK_DATA[bankId] ?? BANK_MOCK_DATA['default'];
    return [{
      id: externalId,
      name: 'Conta Corrente',
      balance: data.balance + (Math.random() * 200 - 100), // pequena variação
      currency: 'BRL',
      type: 'checking',
    }];
  }

  async fetchTransactions(externalId: string, days = 30): Promise<RawBankTransaction[]> {
    await delay(800);
    const bankId = externalId.split('_')[1] ?? 'default';
    const data = BANK_MOCK_DATA[bankId] ?? BANK_MOCK_DATA['default'];
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return data.transactions
      .filter(t => t.date >= cutoff)
      .map((t, i) => ({ ...t, id: `${externalId}_tx_${i}` }));
  }
}

// ─── Provider registry (PART 10) ─────────────────────────────────────────────

export type ProviderKey = 'mock' | 'pluggy' | 'belvo' | 'truelayer';

const PROVIDER_REGISTRY: Partial<Record<ProviderKey, IBankProvider>> = {
  mock: new MockBankProvider(),
  // pluggy:    new PluggyProvider(),     // future: npm install @pluggy/client
  // belvo:     new BelvoProvider(),      // future: npm install @belvo-finance/belvo-js
  // truelayer: new TrueLayerProvider(),  // future: npm install @truelayer/client
};

export function getProvider(key: ProviderKey): IBankProvider {
  const p = PROVIDER_REGISTRY[key];
  if (!p) throw new Error(`Provider "${key}" não registrado.`);
  return p;
}

export function registerProvider(key: ProviderKey, provider: IBankProvider): void {
  PROVIDER_REGISTRY[key] = provider;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
