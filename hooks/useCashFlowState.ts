import { useFinancialState } from './useFinancialState';

type UseCashFlowStateOptions = Parameters<typeof useFinancialState>[0];

/**
 * @deprecated Use `useFinancialState` directly.
 * This hook remains only as a compatibility adapter for legacy call sites.
 */
export function useCashFlowState(options: UseCashFlowStateOptions) {
  return useFinancialState(options);
}
