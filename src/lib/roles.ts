import type { MemberRole } from '../types'

/** Legacy `owner` and `creator` map to `admin`. */
export function normalizeMemberRole(role: MemberRole): MemberRole {
  if (role === 'creator' || role === 'owner') return 'admin'
  return role
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Admin',
  admin: 'Admin',
  creator: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
  no_access: 'No Access',
}

export function roleLabel(role: MemberRole): string {
  return ROLE_LABELS[normalizeMemberRole(role)]
}

export const ROLE_DESCRIPTIONS: Record<'admin' | 'editor' | 'viewer', string> = {
  admin: 'Full workspace access — invite and manage members, create databases, tables, and edit records',
  editor: 'Create tables and edit records — no member management',
  viewer: 'View tables and records only — read-only access',
}

export function isAdminRole(role: MemberRole): boolean {
  return normalizeMemberRole(role) === 'admin'
}

/** Admin and Editor can create/edit table data. */
export function canEditRecords(role: MemberRole): boolean {
  const normalized = normalizeMemberRole(role)
  return normalized === 'admin' || normalized === 'editor'
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
