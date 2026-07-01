import { handle as deleteAccount } from './deleteAccount.ts';
import { handle as sendTestEmails } from './sendTestEmails.ts';
import { handle as getAssistantContext } from './getAssistantContext.ts';
import { handle as validatePublishReadiness } from './validatePublishReadiness.ts';

type Handler = (req: Request, body: any) => Promise<Response>;

const handlers: Record<string, Handler> = {
  deleteAccount,
  sendTestEmails,
  getAssistantContext,
  validatePublishReadiness,
};

export function getHandler(action: string): Handler | undefined {
  return handlers[action];
}
