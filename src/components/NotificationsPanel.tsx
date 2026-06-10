import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { acceptWorkspaceInviteAsync, declineWorkspaceInviteAsync } from '../lib/members'
import { usePendingInvites } from '../hooks/usePendingInvites'
import { useAppNotifications } from '../hooks/useNotifications'
import { markNotificationRead } from '../lib/notifications'
import WorkspaceInviteItem from './WorkspaceInviteItem'
import { useToast } from '../context/ToastContext'

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
      className="relative p-1.5 text-app-faint hover:text-app-muted"
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
  const navigate = useNavigate()
  const toast = useToast()
  const { invites, refresh: refreshInvites } = usePendingInvites(user?.userId, user?.email)
  const notifications = useAppNotifications(user?.userId)
  const [acting, setActing] = useState<string | null>(null)

  const unreadNotifications = notifications.filter((item) => !item.read)
  const isEmpty = invites.length === 0 && notifications.length === 0

  function refresh() {
    refreshInvites()
    onUpdate()
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
      refresh()
      onClose()
      navigate(`/app/w/${result.workspaceId}`)
    } else if (result.error) {
      toast.error(result.error)
    }
  }

  async function handleDecline(inviteId: string) {
    if (!user) return
    setActing(inviteId)
    const result = await declineWorkspaceInviteAsync(inviteId, {
      id: user.userId,
      email: user.email,
    })
    setActing(null)
    if (result.ok) {
      refresh()
    } else if (result.error) {
      toast.error(result.error)
    }
  }

  function openNotification(href?: string, notificationId?: string) {
    if (notificationId) markNotificationRead(notificationId)
    refresh()
    if (href) {
      onClose()
      navigate(href)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close notifications"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-app-border bg-app-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
          <h3 className="text-sm font-semibold text-app-text">Notifications</h3>
          <button type="button" onClick={onClose} className="p-1 text-app-faint hover:text-app-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {isEmpty ? (
            <div className="px-4 py-12 text-center">
              <Bell className="w-8 h-8 text-app-faint mx-auto mb-3" />
              <p className="text-sm text-app-muted">No new notifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-app-border">
              {invites.map((invite) => (
                <li key={invite.id} className="p-4">
                  <p className="text-sm font-medium text-app-text mb-2">Workspace invite</p>
                  <WorkspaceInviteItem
                    invite={invite}
                    acting={acting === invite.id}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                  />
                </li>
              ))}
              {unreadNotifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(item.href, item.id)}
                    className="w-full text-left p-4 hover:bg-app-surface-hover"
                  >
                    <p className="text-sm font-medium text-app-text">{item.title}</p>
                    <p className="text-xs text-app-faint mt-1">{item.body}</p>
                  </button>
                </li>
              ))}
              {notifications
                .filter((item) => item.read)
                .map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(item.href)}
                      className="w-full text-left p-4 opacity-60 hover:bg-app-surface-hover"
                    >
                      <p className="text-sm text-app-text">{item.title}</p>
                      <p className="text-xs text-app-faint mt-1">{item.body}</p>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export { useNotificationCount } from '../hooks/useNotifications'
