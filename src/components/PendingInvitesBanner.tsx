import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { acceptWorkspaceInviteAsync, declineWorkspaceInvite } from '../lib/members'
import { usePendingInvites } from '../hooks/usePendingInvites'
import WorkspaceInviteItem from './WorkspaceInviteItem'

interface PendingInvitesBannerProps {
  onUpdate?: () => void
}

export default function PendingInvitesBanner({ onUpdate }: PendingInvitesBannerProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { invites, refresh } = usePendingInvites(user?.userId, user?.email)
  const [acting, setActing] = useState<string | null>(null)

  if (!user || invites.length === 0) return null

  function handleUpdate() {
    refresh()
    onUpdate?.()
  }

  async function handleAccept(inviteId: string) {
    if (!user) return
    setActing(inviteId)
    const result = await acceptWorkspaceInviteAsync(inviteId, {
      id: user.userId,
      email: user.email,
      name: user.name,
    })
    setActing(null)
    if (result.ok && result.workspaceId) {
      handleUpdate()
      navigate(`/app/w/${result.workspaceId}`)
    } else if (result.error) {
      alert(result.error)
    }
  }

  function handleDecline(inviteId: string) {
    if (!user) return
    setActing(inviteId)
    declineWorkspaceInvite(inviteId, { id: user.userId, email: user.email })
    setActing(null)
    handleUpdate()
  }

  return (
    <div className="shrink-0 border-b border-brand-500/30 bg-brand-500/10">
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-300">
          <Bell className="w-3.5 h-3.5" />
          {invites.length === 1 ? 'Workspace invite' : `${invites.length} workspace invites`}
        </div>
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="rounded-lg border border-brand-500/20 bg-app-surface/80 px-3 py-2.5"
          >
            <WorkspaceInviteItem
              invite={invite}
              acting={acting === invite.id}
              compact
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
