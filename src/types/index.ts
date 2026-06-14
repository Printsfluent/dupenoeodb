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
  /** Emoji character or `social:{id}` (e.g. social:instagram). */
  icon?: string | null
  /** When set, only members in these teams (plus admins) can access the table. */
  teamIds?: string[]
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
  logo?: string | null
  settings: WorkspaceSettings
  createdAt: string
}

/** Admin, Editor, Viewer. `owner` and `creator` are legacy aliases for `admin`. */
export type MemberRole = 'owner' | 'admin' | 'creator' | 'editor' | 'viewer' | 'no_access'
export type MemberStatus = 'pending' | 'active' | 'blocked' | 'left'

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'

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
  lastActiveAt?: string
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
  description?: string
  /** Emoji character or `social:{id}` (e.g. social:instagram). */
  icon?: string | null
  /** When set, only members in these teams (plus admins) can access the database. */
  teamIds?: string[]
  tables: Table[]
  createdAt: string
  /** Set on every local save so cloud sync can prefer the latest edits. */
  updatedAt?: string
}

/** SheetFlow spec name for a Base (database inside a workspace). */
export type Database = Base

/** @deprecated Use Base / Database */
export type Project = Base

export type ActivityAction =
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'member_invited'
  | 'member_removed'
  | 'role_changed'
  | 'database_created'
  | 'invite_accepted'

export interface ActivityEvent {
  id: string
  workspaceId: string
  action: ActivityAction
  actorId: string
  actorName: string
  targetLabel: string
  createdAt: string
}

export type NotificationType =
  | 'workspace_invite'
  | 'role_changed'
  | 'mention'
  | 'task_assigned'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  href?: string
  read: boolean
  createdAt: string
}

export interface TablePermissions {
  tableId: string
  databaseId: string
  workspaceId: string
  viewerCanView: boolean
  editorCanCreate: boolean
  editorCanEdit: boolean
  editorCanDelete: boolean
}

export interface ApiKey {
  id: string
  userId: string
  workspaceId: string
  label: string
  keyPrefix: string
  createdAt: string
  revokedAt?: string | null
}

export type TableViewType = 'grid' | 'kanban' | 'calendar' | 'gallery'

export interface SavedTableView {
  id: string
  tableId: string
  databaseId: string
  name: string
  type: TableViewType
  config: Record<string, unknown>
  createdBy: string
  createdAt: string
}

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
