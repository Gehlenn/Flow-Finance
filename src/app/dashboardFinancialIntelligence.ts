import { Account } from '../../models/Account';
import { Transaction } from '../../types';
import {
  buildProductFinancialIntelligence,
  type ProductFinancialIntelligence,
} from './productFinancialIntelligence';

export interface DashboardFinancialIntelligence extends ProductFinancialIntelligence {}

export function buildDashboardFinancialIntelligence(input: {
  userId?: string | null;
  accounts?: Account[];
  transactions: Transaction[];
}): DashboardFinancialIntelligence {
  return buildProductFinancialIntelligence(input);
}