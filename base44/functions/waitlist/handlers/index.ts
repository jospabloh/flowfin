import { handle as joinWaitlist } from './joinWaitlist.ts';
import { handle as listWaitlist } from './listWaitlist.ts';
import { handle as markWaitlistInvited } from './markWaitlistInvited.ts';

type Handler = (req: Request, body: any) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  joinWaitlist,
  listWaitlist,
  markWaitlistInvited,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
