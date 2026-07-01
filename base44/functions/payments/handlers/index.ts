import { handle as linkTransactionToPayment } from './linkTransactionToPayment.ts';
import { handle as registerRentalPaymentSafe } from './registerRentalPaymentSafe.ts';

type Handler = (req: Request, body: any) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  linkTransactionToPayment,
  registerRentalPaymentSafe,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
