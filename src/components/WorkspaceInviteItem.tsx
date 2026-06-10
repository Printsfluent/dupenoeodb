import { Check, UserPlus, XCircle } from 'lucide-react'
import type { WorkspaceInvite } from '../types'

interface WorkspaceInviteItemProps {
  invite: WorkspaceInvite
  acting?: boolean
  compact?: boolean
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
}

function roleLabel(role: WorkspaceInvite['role']) {
  return role === 'no_access' ? 'no access' : role
}

export default function WorkspaceInviteItem({
  invite,
  acting = false,
  compact = false,
  onAccept,
  onDecline,
}: WorkspaceInviteItemProps) {
  return (
    <div className={`flex items-center gap-3 ${compact ? 'flex-wrap sm:flex-nowrap' : 'flex-col sm:flex-row sm:items-start'}`}>
      <div className={`flex items-center gap-3 min-w-0 ${compact ? 'flex-1' : 'w-full'}`}>
        <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
          <UserPlus className="w-4 h-4" />
        </div>
        <p className={`text-sm text-app-text min-w-0 ${compact ? 'truncate' : ''}`}>
          <span className="font-medium">{invite.invitedByName}</span>
          {' '}invited you to{' '}
          <span className="font-semibold">{invite.workspaceName}</span>
          {' '}as{' '}
          <span className="capitalize font-medium text-brand-300">{roleLabel(invite.role)}</span>
        </p>
      </div>
      <div className={`flex gap-2 shrink-0 ${compact ? '' : 'w-full sm:w-auto'}`}>
        <button
          type="button"
          disabled={acting}
          onClick={() => onAccept(invite.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Accept
        </button>
        <button
          type="button"
          disabled={acting}
          onClick={() => onDecline(invite.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-border text-app-muted text-xs font-medium hover:bg-app-surface-active disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          Decline
        </button>
      </div>
    </div>
  )
}
