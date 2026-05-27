import { FinancialGraphEdge } from '../../models/FinancialGraphEdge';
import { FinancialGraphNode } from '../../models/FinancialGraphNode';

export interface FinancialGraph {
  nodes: Map<string, FinancialGraphNode>;
  edges: FinancialGraphEdge[];
  built_at: string;
  user_id: string;
  stats: {
    node_count: number;
    edge_count: number;
    merchant_count: number;
    category_count: number;
    subscription_count: number;
    transaction_count: number;
  };
}
