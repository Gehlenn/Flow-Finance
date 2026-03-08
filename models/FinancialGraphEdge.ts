/**
 * FINANCIAL GRAPH EDGE — src/models/FinancialGraphEdge.ts
 *
 * Represents a directed relationship between two nodes
 * in the Financial Intelligence Graph.
 *
 * Edge relation vocabulary:
 *   owns            — user → account
 *   has_transaction — account → transaction
 *   paid_to         — transaction → merchant
 *   belongs_to      — transaction → category
 *   is_subscription — merchant → subscription
 *   co_occurs       — merchant ↔ merchant  (frequent same-day purchases)
 *   same_category   — merchant → category  (aggregated)
 */

export type FinancialGraphRelation =
  | 'owns'             // user → account
  | 'has_transaction'  // account → transaction
  | 'paid_to'          // transaction → merchant
  | 'belongs_to'       // transaction → category
  | 'is_subscription'  // merchant → subscription
  | 'co_occurs'        // merchant ↔ merchant (spending pattern)
  | 'same_category'    // merchant → category (aggregated)
  | 'transferred_to'   // account → account (internal transfers)
  | 'recurring_from';  // subscription → merchant (recurrence link)

export interface FinancialGraphEdge {
  from:     string;
  to:       string;
  relation: FinancialGraphRelation | string;  // string allows custom relations
  weight?:  number;   // numeric strength of the relation (e.g. total spend, count)
  metadata?: Record<string, unknown>;
}
