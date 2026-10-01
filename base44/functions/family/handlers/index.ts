import { handle as approveMember } from './approveMember.ts';
import { handle as cancelJoinRequest } from './cancelJoinRequest.ts';
import { handle as createFamily } from './createFamily.ts';
import { handle as findFamilyByCode } from './findFamilyByCode.ts';
import { handle as getFamilyBillingStatus } from './getFamilyBillingStatus.ts';
import { handle as getFamilyLicenseInfo } from './getFamilyLicenseInfo.ts';
import { handle as getMyFamily } from './getMyFamily.ts';
import { handle as getMyMembership } from './getMyMembership.ts';
import { handle as linkPersonToMember } from './linkPersonToMember.ts';
import { handle as listMemberships } from './listMemberships.ts';
import { handle as rejectMember } from './rejectMember.ts';
import { handle as removeMember } from './removeMember.ts';
import { handle as selfJoin } from './selfJoin.ts';
import { handle as verifyFamilyAccess } from './verifyFamilyAccess.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  approveMember,
  cancelJoinRequest,
  createFamily,
  findFamilyByCode,
  getFamilyBillingStatus,
  getFamilyLicenseInfo,
  getMyFamily,
  getMyMembership,
  linkPersonToMember,
  listMemberships,
  rejectMember,
  removeMember,
  selfJoin,
  verifyFamilyAccess,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
