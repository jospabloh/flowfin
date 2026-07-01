import { handle as detectAnomalies } from './detectAnomalies.ts';
import { handle as detectRecurring } from './detectRecurring.ts';
import { handle as getAverages } from './getAverages.ts';
import { handle as getBreakdownByCategory } from './getBreakdownByCategory.ts';
import { handle as getBreakdownByMerchant } from './getBreakdownByMerchant.ts';
import { handle as getBreakdownByPaymentMethod } from './getBreakdownByPaymentMethod.ts';
import { handle as getBreakdownByPerson } from './getBreakdownByPerson.ts';
import { handle as getBudgetSuggestion } from './getBudgetSuggestion.ts';
import { handle as getCategoryStats } from './getCategoryStats.ts';
import { handle as getPeriodComparison } from './getPeriodComparison.ts';
import { handle as getPeriodTotals } from './getPeriodTotals.ts';
import { handle as getPredictiveChips } from './getPredictiveChips.ts';
import { handle as getSavingsOpportunities } from './getSavingsOpportunities.ts';
import { handle as getSmartSuggestions } from './getSmartSuggestions.ts';
import { handle as getTimeSeries } from './getTimeSeries.ts';
import { handle as getTopTransactions } from './getTopTransactions.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  detectAnomalies,
  detectRecurring,
  getAverages,
  getBreakdownByCategory,
  getBreakdownByMerchant,
  getBreakdownByPaymentMethod,
  getBreakdownByPerson,
  getBudgetSuggestion,
  getCategoryStats,
  getPeriodComparison,
  getPeriodTotals,
  getPredictiveChips,
  getSavingsOpportunities,
  getSmartSuggestions,
  getTimeSeries,
  getTopTransactions,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
