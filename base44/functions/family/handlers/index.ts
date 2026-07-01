import { handle as approveMember } from './approveMember.ts';
import { handle as removeMember } from './removeMember.ts';
import { handle as selfJoin } from './selfJoin.ts';
import { handle as createFamily } from './createFamily.ts';
import { handle as linkPersonToMember } from './linkPersonToMember.ts';
import { handle as getMyMembership } from './getMyMembership.ts';
import { handle as getFamilyBillingStatus } from './getFamilyBillingStatus.ts';
import { handle as getFamilyLicenseInfo } from './getFamilyLicenseInfo.ts';
import { handle as findFamilyByCode } from './findFamilyByCode.ts';
import { handle as getMyFamily } from './getMyFamily.ts';
import { handle as verifyFamilyAccess } from './verifyFamilyAccess.ts';

const registry: Record<string, (req: Request, body: any) => Promise<Response>> = {
  approveMember,
  removeMember,
  selfJoin,
  createFamily,
  linkPersonToMember,
  getMyMembership,
  getFamilyBillingStatus,
  getFamilyLicenseInfo,
  findFamilyByCode,
  getMyFamily,
  verifyFamilyAccess,
};

export function getHandler(action: string) {
  return registry[action];
}
