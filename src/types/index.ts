export type ColumnType =
  | 'singleLineText'
  | 'longText'
  | 'number'
  | 'autoNumber'
  | 'decimal'
  | 'attachment'
  | 'checkbox'
  | 'rating'
  | 'colour'
  | 'dateTime'
  | 'geometry'
  | 'geoData'
  | 'json'
  | 'user'
  | 'singleSelect'
  | 'multiSelect'
  /** @deprecated Use singleLineText */
  | 'text'
  /** @deprecated Use singleSelect */
  | 'select'
  /** @deprecated Use dateTime */
  | 'date'

export type ColumnEditPermission = 'everyone' | 'creators_only'

export interface SelectOption {
  id: string
  label: string
  color: string
}

export interface Column {
  id: string
  name: string
  type: ColumnType
  description?: string
  hidden?: boolean
  isDisplayValue?: boolean
  editPermission?: ColumnEditPermission
  options?: SelectOption[]
  colorCodeOptions?: boolean
  alphabetizeOptions?: boolean
  defaultValue?: string
}

export interface Row {
  id: string
  cells: Record<string, string>
}

export interface Table {
  id: string
  name: string
  columns: Column[]
  rows: Row[]
}

export interface WorkspaceSettings {
  allowMembersToLeave: boolean
}

export interface Workspace {
  id: string
  slug: string
  ownerId: string
  name: string
  color: string
  settings: WorkspaceSettings
  createdAt: string
}

export type MemberRole = 'owner' | 'creator' | 'editor' | 'viewer' | 'no_access'
export type MemberStatus = 'pending' | 'active' | 'blocked' | 'left'

export type InviteStatus = 'pending' | 'accepted' | 'declined'

export interface WorkspaceInvite {
  id: string
  workspaceId: string
  workspaceName: string
  memberId: string
  email: string
  userId: string | null
  role: MemberRole
  teamIds: string[]
  invitedBy: string
  invitedByName: string
  status: InviteStatus
  createdAt: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string | null
  email: string
  name: string
  role: MemberRole
  status: MemberStatus
  teamIds: string[]
  tableAccess: string[]
  joinedAt: string
}

export interface Team {
  id: string
  workspaceId: string
  name: string
  color: string
  memberIds: string[]
  createdBy: string
  createdAt: string
}

export interface Base {
  id: string
  workspaceId: string
  userId: string
  name: string
  tables: Table[]
  createdAt: string
}

/** @deprecated Use Base */
export type Project = Base

export type PlanId = 'free' | 'og'

export interface User {
  id: string
  name: string
  email: string
  password?: string
  avatarEmoji?: string
  plan?: PlanId
  planManaged?: boolean
  createdAt?: string
}

export interface Session {
  userId: string
  email: string
  name: string
  avatarEmoji?: string
  plan?: PlanId
}
