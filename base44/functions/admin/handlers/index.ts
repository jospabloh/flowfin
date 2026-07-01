import { handle as deleteAccount } from './deleteAccount.ts';
import { handle as getAssistantContext } from './getAssistantContext.ts';
import { handle as sendTestEmails } from './sendTestEmails.ts';
import { handle as validatePublishReadiness } from './validatePublishReadiness.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  deleteAccount,
  getAssistantContext,
  sendTestEmails,
  validatePublishReadiness,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
