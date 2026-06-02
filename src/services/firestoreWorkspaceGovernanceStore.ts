import {
  addWorkspaceMember as addWorkspaceMemberImpl,
  listWorkspaceMembers as listWorkspaceMembersImpl,
  removeWorkspaceMember as removeWorkspaceMemberImpl,
} from './firestoreWorkspaceMembershipStore';
import {
  listWorkspaceAuditEvents as listWorkspaceAuditEventsImpl,
  listWorkspaceAuditEventsPage as listWorkspaceAuditEventsPageImpl,
  writeAuditLogEvent as writeAuditLogEventImpl,
} from './firestoreWorkspaceAuditStore';
import {
  createPersonalWorkspace as createPersonalWorkspaceImpl,
  ensureActiveWorkspaceForUser as ensureActiveWorkspaceForUserImpl,
  listUserWorkspaceSummaries as listUserWorkspaceSummariesImpl,
} from './firestoreWorkspaceBootstrapStore';

export const writeAuditLogEvent = writeAuditLogEventImpl;
export const listWorkspaceAuditEvents = listWorkspaceAuditEventsImpl;
export const listWorkspaceAuditEventsPage = listWorkspaceAuditEventsPageImpl;
export const listWorkspaceMembers = listWorkspaceMembersImpl;
export const addWorkspaceMember = addWorkspaceMemberImpl;
export const removeWorkspaceMember = removeWorkspaceMemberImpl;
export const listUserWorkspaceSummaries = listUserWorkspaceSummariesImpl;
export const createPersonalWorkspace = createPersonalWorkspaceImpl;
export const ensureActiveWorkspaceForUser = ensureActiveWorkspaceForUserImpl;

export type {
  AuditLogCursor,
  AuditLogDocument,
  TenantDocument,
  TenantMemberDocument,
  UserIdentity,
  WorkspaceDocument,
  WorkspaceImportDocument,
  WorkspaceInsightDocument,
  WorkspaceMemberDocument,
  WorkspaceRole,
  WorkspaceSummary,
  WorkspaceSubscriptionDocument,
} from './firestoreWorkspaceTypes';
