import type { MemberRole } from '../types'

/** Legacy `creator` maps to spec `admin`. */
export function normalizeMemberRole(role: MemberRole): MemberRole {
  if (role === 'creator') return 'admin'
  return role
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  creator: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
  no_access: 'No Access',
}

export const ROLE_DESCRIPTIONS: Record<'admin' | 'editor' | 'viewer', string> = {
  admin: 'Create databases, invite members, and manage tables (cannot delete workspace)',
  editor: 'Create tables and edit records — no member management',
  viewer: 'View tables and records only — read-only access',
}

export function isAdminRole(role: MemberRole): boolean {
  const normalized = normalizeMemberRole(role)
  return normalized === 'owner' || normalized === 'admin'
}

export function canInviteByRole(role: MemberRole): boolean {
  return isAdminRole(role)
}

export type TablePermission = 'view' | 'create' | 'edit' | 'delete'

const TABLE_PERMISSION_MATRIX: Record<MemberRole, Record<TablePermission, boolean>> = {
  owner: { view: true, create: true, edit: true, delete: true },
  admin: { view: true, create: true, edit: true, delete: true },
  creator: { view: true, create: true, edit: true, delete: true },
  editor: { view: true, create: true, edit: true, delete: true },
  viewer: { view: true, create: false, edit: false, delete: false },
  no_access: { view: false, create: false, edit: false, delete: false },
}

export function tablePermissionForRole(
  role: MemberRole,
  permission: TablePermission,
): boolean {
  return TABLE_PERMISSION_MATRIX[normalizeMemberRole(role)]?.[permission] ?? false
}
