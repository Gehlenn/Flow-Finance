import { Account } from '../../models/Account';
import {
  Alert,
  Category,
  Goal,
  Receivable,
  Reminder,
  ReminderType,
  Transaction,
  TransactionType,
} from '../../types';
import { type EntityState, type WorkspaceSummary } from '../services/firestoreWorkspaceTypes';

type StorageLike = Pick<Storage, 'getItem'>;

export type DemoBootstrap = {
  userId: string;
  userEmail: string;
  userName: string;
  workspaceId: string;
  workspaceName: string;
  tenantId: string;
  tenantName: string;
  token: string;
  plan: 'free' | 'pro';
};

export type DemoProfileState = {
  name: string | null;
  theme: 'light' | 'dark';
  alerts: Alert[];
  reminders: Reminder[];
};

export type DemoWorkspaceContext = {
  userId: string;
  tenantId: string;
  workspaceId: string;
  referenceDate?: Date;
};

const DEMO_QUERY_KEY = 'demoData';
const DEMO_STORAGE_KEY = 'flow_demo_data';
const DEMO_USER_ID_KEY = 'flow_demo_user_id';
const DEMO_USER_EMAIL_KEY = 'flow_demo_user_email';
const DEMO_USER_NAME_KEY = 'flow_demo_user_name';
const DEMO_WORKSPACE_ID_KEY = 'flow_demo_workspace_id';
const DEMO_WORKSPACE_NAME_KEY = 'flow_demo_workspace_name';
const DEMO_TENANT_ID_KEY = 'flow_demo_tenant_id';
const DEMO_TENANT_NAME_KEY = 'flow_demo_tenant_name';
const DEMO_TOKEN_KEY = 'flow_demo_auth_token';
const DEMO_PLAN_KEY = 'flow_demo_plan';

function canEnableDemoBootstrap(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function readValue(
  params: URLSearchParams,
  storage: StorageLike | undefined,
  queryKey: string,
  storageKey: string,
  fallback: string,
): string {
  return params.get(queryKey) || storage?.getItem(storageKey) || fallback;
}

function readFlag(params: URLSearchParams, storage: StorageLike | undefined): boolean {
  return params.get(DEMO_QUERY_KEY) === '1' || storage?.getItem(DEMO_STORAGE_KEY) === '1';
}

function readDemoPlan(params: URLSearchParams, storage: StorageLike | undefined): 'free' | 'pro' {
  const raw = readValue(params, storage, 'demoPlan', DEMO_PLAN_KEY, 'pro').toLowerCase();
  return raw === 'free' ? 'free' : 'pro';
}

function toIso(referenceDate: Date, dayOffset: number, hours = 10): string {
  const value = new Date(referenceDate);
  value.setDate(value.getDate() + dayOffset);
  value.setHours(hours, 0, 0, 0);
  return value.toISOString();
}

export function getDemoBootstrap(
  search: string,
  storage?: StorageLike,
  enabled = false,
): DemoBootstrap | null {
  if (!enabled) {
    return null;
  }

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (!readFlag(params, storage)) {
    return null;
  }

  return {
    userId: readValue(params, storage, 'demoUserId', DEMO_USER_ID_KEY, 'demo-user'),
    userEmail: readValue(params, storage, 'demoUserEmail', DEMO_USER_EMAIL_KEY, 'demo@flowfinance.local'),
    userName: readValue(params, storage, 'demoUserName', DEMO_USER_NAME_KEY, 'Marina Demo'),
    workspaceId: readValue(params, storage, 'demoWorkspaceId', DEMO_WORKSPACE_ID_KEY, 'ws-demo-flow-finance'),
    workspaceName: readValue(params, storage, 'demoWorkspaceName', DEMO_WORKSPACE_NAME_KEY, 'Atelie Aurora'),
    tenantId: readValue(params, storage, 'demoTenantId', DEMO_TENANT_ID_KEY, 'tenant-demo-flow-finance'),
    tenantName: readValue(params, storage, 'demoTenantName', DEMO_TENANT_NAME_KEY, 'Flow Finance Demo'),
    token: readValue(params, storage, 'demoToken', DEMO_TOKEN_KEY, 'demo-token'),
    plan: readDemoPlan(params, storage),
  };
}

export function createDemoProfileState(): DemoProfileState {
  return {
    name: 'Marina Demo',
    theme: 'light',
    alerts: [
      {
        id: 'demo-alert-1',
        category: Category.NEGOCIO,
        threshold: 2500,
        timeframe: 'mensal',
      },
      {
        id: 'demo-alert-2',
        category: 'Geral',
        threshold: 1,
        timeframe: 'semanal',
      },
    ],
    reminders: [],
  };
}

export function createDemoWorkspaceEntities(context: DemoWorkspaceContext): EntityState {
  const referenceDate = context.referenceDate || new Date();
  const createdAt = toIso(referenceDate, -28, 9);

  const transactions: Transaction[] = [
    {
      id: 'demo-tx-1',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      amount: 8600,
      type: TransactionType.RECEITA,
      category: Category.NEGOCIO,
      description: 'Projeto Aurora - parcela 1',
      date: toIso(referenceDate, -5, 12),
    },
    {
      id: 'demo-tx-2',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      amount: 4200,
      type: TransactionType.RECEITA,
      category: Category.NEGOCIO,
      description: 'Plano mensal recorrente',
      date: toIso(referenceDate, -14, 12),
    },
    {
      id: 'demo-tx-3',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      amount: 2380,
      type: TransactionType.DESPESA,
      category: Category.NEGOCIO,
      description: 'Folha e operacao',
      date: toIso(referenceDate, -3, 16),
    },
    {
      id: 'demo-tx-4',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      amount: 430,
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      description: 'Assinaturas e suporte',
      date: toIso(referenceDate, -9, 10),
    },
  ];

  const reminders: Reminder[] = [
    {
      id: 'demo-rem-1',
      title: 'Projeto Aurora - parcela 2',
      date: toIso(referenceDate, 4, 9),
      type: ReminderType.TRABALHO,
      amount: 5400,
      completed: false,
      priority: 'alta',
    },
    {
      id: 'demo-rem-2',
      title: 'Cliente retido em revisao',
      date: toIso(referenceDate, -3, 9),
      type: ReminderType.NEGOCIO,
      amount: 1900,
      completed: false,
      priority: 'alta',
    },
    {
      id: 'demo-rem-3',
      title: 'Parcela concluida',
      date: toIso(referenceDate, -6, 9),
      type: ReminderType.NEGOCIO,
      amount: 8600,
      completed: true,
      priority: 'media',
    },
  ];

  const receivables: Receivable[] = [
    {
      id: 'demo-recv-1',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      description: 'Projeto Aurora - parcela 2',
      expected_amount: 5400,
      realized_amount: 0,
      due_date: toIso(referenceDate, 4, 9),
      realized_at: null,
      status: 'open',
      source: 'reminder_migration',
      source_ref: 'demo-rem-1',
      customer_label: 'Projeto Aurora',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: 'demo-recv-2',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      description: 'Cliente retido em revisao',
      expected_amount: 1900,
      realized_amount: 0,
      due_date: toIso(referenceDate, -3, 9),
      realized_at: null,
      status: 'overdue',
      source: 'manual',
      source_ref: 'demo-rem-2',
      customer_label: 'Cliente Retido',
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: 'demo-recv-3',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      description: 'Parcela concluida',
      expected_amount: 8600,
      realized_amount: 8600,
      due_date: toIso(referenceDate, -6, 9),
      realized_at: toIso(referenceDate, -2, 10),
      status: 'realized',
      source: 'transaction_link',
      source_ref: 'demo-tx-1',
      customer_label: 'Projeto Aurora',
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const accounts: Account[] = [
    {
      id: 'demo-acc-1',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      name: 'Conta principal',
      type: 'bank',
      balance: 15840,
      currency: 'BRL',
      created_at: createdAt,
    },
    {
      id: 'demo-acc-2',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      name: 'Caixa',
      type: 'cash',
      balance: 420,
      currency: 'BRL',
      created_at: createdAt,
    },
  ];

  const goals: Goal[] = [
    {
      id: 'demo-goal-1',
      user_id: context.userId,
      tenant_id: context.tenantId,
      workspace_id: context.workspaceId,
      title: 'Reserva operacional de 30 dias',
      targetAmount: 30000,
      currentAmount: 16260,
      deadline: toIso(referenceDate, 60, 9),
      category: Category.NEGOCIO,
    },
  ];

  return {
    accounts,
    transactions,
    goals,
    reminders,
    receivables,
  };
}

export function isDemoBootstrapAvailable(): boolean {
  return canEnableDemoBootstrap();
}

export function getDemoBootstrapIdentity(): {
  userId: string;
  email: string | null;
  name: string | null;
} | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const bootstrap = getDemoBootstrap(window.location.search, window.localStorage, canEnableDemoBootstrap());
  if (!bootstrap) {
    return undefined;
  }

  return {
    userId: bootstrap.userId,
    email: bootstrap.userEmail,
    name: bootstrap.userName,
  };
}

export function canUseDemoWorkspaceFallback(userId?: string | null): boolean {
  const identity = getDemoBootstrapIdentity();
  if (!identity?.userId) {
    return false;
  }

  return !userId || userId === identity.userId;
}

export function buildDemoWorkspaceSummary(): WorkspaceSummary | undefined {
  const bootstrap = getDemoBootstrap(window.location.search, window.localStorage, canEnableDemoBootstrap());
  if (!bootstrap) {
    return undefined;
  }

  return {
    workspaceId: bootstrap.workspaceId,
    tenantId: bootstrap.tenantId,
    name: bootstrap.workspaceName,
    tenantName: bootstrap.tenantName,
    plan: bootstrap.plan,
    role: 'owner' as const,
    isDefault: true,
  };
}
