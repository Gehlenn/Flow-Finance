/**
 * AI Task Queue - Task Types
 * Defines all types of AI tasks that can be queued
 */

import { Transaction, Goal } from '../../../types';
import { Account } from '../../../models/Account';

export enum AITaskType {
  INSIGHT_GENERATION = 'INSIGHT_GENERATION',
  CASHFLOW_SIMULATION = 'CASHFLOW_SIMULATION',
  FINANCIAL_REPORT = 'FINANCIAL_REPORT',
  LEAK_DETECTION = 'LEAK_DETECTION',
  AUTOPILOT_ANALYSIS = 'AUTOPILOT_ANALYSIS',
  RISK_ANALYSIS = 'RISK_ANALYSIS',
  SUBSCRIPTION_DETECTION = 'SUBSCRIPTION_DETECTION',
  SALARY_DETECTION = 'SALARY_DETECTION',
  FIXED_EXPENSE_DETECTION = 'FIXED_EXPENSE_DETECTION',
}

export enum AITaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum AITaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

export interface AITask<T = any> {
  id: string;
  type: AITaskType;
  payload: T;
  status: AITaskStatus;
  priority: AITaskPriority;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: {
    message: string;
    stack?: string;
    timestamp: number;
  };
  retryCount: number;
  maxRetries: number;
  userId: string;
}

export interface AITaskProgress {
  taskId: string;
  status: AITaskStatus;
  progress?: number; // 0-100
  message?: string;
  timestamp: number;
}

export interface AITaskResult<T = any> {
  taskId: string;
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  timestamp: number;
}

// Payload types for each task

export interface InsightGenerationPayload {
  transactions: Transaction[];
  accounts: Account[];
  dateRange?: { start: Date; end: Date };
}

export interface CashflowSimulationPayload {
  transactions: Transaction[];
  horizon: number; // days
  scenarios?: string[];
}

export interface FinancialReportPayload {
  transactions: Transaction[];
  month: number;
  year: number;
}

export interface LeakDetectionPayload {
  transactions: Transaction[];
}

export interface AutopilotAnalysisPayload {
  transactions: Transaction[];
  accounts: Account[];
  goals?: Goal[];
}

export interface RiskAnalysisPayload {
  transactions: Transaction[];
  accounts: Account[];
}