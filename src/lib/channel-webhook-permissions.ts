import { getOrgUserRole, userCan } from './role-permissions';

export function canManageChannelWebhooks(
  orgData: Parameters<typeof userCan>[0],
): boolean {
  // When no role data has arrived, the authenticated backend remains authoritative.
  return !getOrgUserRole(orgData) || userCan(orgData, 'create:webhooks');
}
