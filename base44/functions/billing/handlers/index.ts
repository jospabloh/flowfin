import { handle as activateLicense } from './activateLicense.ts';
import { handle as confirmLicensePayment } from './confirmLicensePayment.ts';
import { handle as createPublicSnapshot } from './createPublicSnapshot.ts';
import { handle as getPublicSnapshot } from './getPublicSnapshot.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  activateLicense,
  confirmLicensePayment,
  createPublicSnapshot,
  getPublicSnapshot,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
