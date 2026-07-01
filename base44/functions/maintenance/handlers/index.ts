import { handle as backfillModulePermissions } from './backfillModulePermissions.ts';
import { handle as backfillPaymentFamilyId } from './backfillPaymentFamilyId.ts';
import { handle as backfillDefaultPerson } from './backfillDefaultPerson.ts';
import { handle as fixCategories } from './fixCategories.ts';
import { handle as fixUserData } from './fixUserData.ts';
import { handle as fixUserFamilyId } from './fixUserFamilyId.ts';
import { handle as repairUserData } from './repairUserData.ts';
import { handle as debugFiniaData } from './debugFiniaData.ts';
import { handle as testAgentMultiFamilySupport } from './testAgentMultiFamilySupport.ts';
import { handle as importExcelData } from './importExcelData.ts';
import { handle as migrateViewOnlySince } from './migrateViewOnlySince.ts';

type Handler = (req: Request, body: any) => Promise<Response>;

const handlers: Record<string, Handler> = {
  backfillModulePermissions,
  backfillPaymentFamilyId,
  backfillDefaultPerson,
  fixCategories,
  fixUserData,
  fixUserFamilyId,
  repairUserData,
  debugFiniaData,
  testAgentMultiFamilySupport,
  importExcelData,
  migrateViewOnlySince,
};

export function getHandler(action: string): Handler | undefined {
  return handlers[action];
}
