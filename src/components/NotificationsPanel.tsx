import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X, UserPlus, Check, XCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import {
  acceptWorkspaceInvite,
  declineWorkspaceInvite,
} from '../lib/members'
import { getPendingInvitesForUser, getPendingInviteCount } from '../lib/invites'
import type { WorkspaceInvite } from '../types'

interface NotificationsPanelProps {
  onClose: () => void
  onUpdate: () => void
}

export function NotificationBell({
  onClick,
  count,
}: {
  onClick: () => void
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative p-1.5 text-gray-500 hover:text-gray-300"
      aria-label="Notifications"
    >
      <Bell className="w-4 h-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-[10px] font-bold text-white flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

export default function NotificationsPanel({ onClose, onUpdate }: NotificationsPanelProps) {
  const { user } = useAuth()
  const { cacheVersion } = useData()
  const navigate = useNavigate()
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setInvites(getPendingInvitesForUser(user.userId, user.email))
    }
  }, [user, cacheVersion])

  function refresh() {
    if (!user) return
    setInvites(getPendingInvitesForUser(user.userId, user.email))
    onUpdate()
  }

  function handleAccept(inviteId: string) {
    if (!user) return
    setActing(inviteId)
    const result = acceptWorkspaceInvite(inviteId, {
      id: user.userId,
      email: user.email,
      name: user.name,
    })
    setActing(null)
    if (result.ok && result.workspaceId) {
      refresh()
      onClose()
      navigate(`/app/w/${result.workspaceId}`)
    }
  }

  function handleDecline(inviteId: string) {
    if (!user) return
    setActing(inviteId)
    declineWorkspaceInvite(inviteId, { id: user.userId, email: user.email })
    setActing(null)
    refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close notifications"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
          <h3 className="text-sm font-semibold text-white">Notifications</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {invites.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Bell className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No new notifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#2a2a2a]">
              {invites.map((invite) => (
                <li key={invite.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">Workspace invite</p>
                      <p className="text-xs text-gray-400 mt-1">
                        <span className="text-gray-300">{invite.invitedByName}</span> invited you to join{' '}
                        <span className="text-white font-medium">{invite.workspaceName}</span> as{' '}
                        <span className="capitalize">{invite.role}</span>
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          disabled={acting === invite.id}
                          onClick={() => handleAccept(invite.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={acting === invite.id}
                          onClick={() => handleDecline(invite.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-gray-400 text-xs font-medium hover:bg-[#2a2a2a] disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export function useInviteCount(userId: string | undefined, email: string | undefined) {
  const { cacheVersion } = useData()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (userId && email) {
      setCount(getPendingInviteCount(userId, email))
    } else {
      setCount(0)
    }
  }, [userId, email, cacheVersion])

  return { count, refresh: () => userId && email && setCount(getPendingInviteCount(userId, email)) }
}
