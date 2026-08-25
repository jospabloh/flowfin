import { handle as backfillDefaultPerson } from './backfillDefaultPerson.ts';
import { handle as backfillModulePermissions } from './backfillModulePermissions.ts';
import { handle as backfillPaymentFamilyId } from './backfillPaymentFamilyId.ts';
import { handle as backfillUserFamilyId } from './backfillUserFamilyId.ts';
import { handle as debugFiniaData } from './debugFiniaData.ts';
import { handle as fixCategories } from './fixCategories.ts';
import { handle as fixUserData } from './fixUserData.ts';
import { handle as fixUserFamilyId } from './fixUserFamilyId.ts';
import { handle as importExcelData } from './importExcelData.ts';
import { handle as migrateViewOnlySince } from './migrateViewOnlySince.ts';
import { handle as repairUserData } from './repairUserData.ts';
import { handle as testAgentMultiFamilySupport } from './testAgentMultiFamilySupport.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  backfillDefaultPerson,
  backfillModulePermissions,
  backfillPaymentFamilyId,
  backfillUserFamilyId,
  debugFiniaData,
  fixCategories,
  fixUserData,
  fixUserFamilyId,
  importExcelData,
  migrateViewOnlySince,
  repairUserData,
  testAgentMultiFamilySupport,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}