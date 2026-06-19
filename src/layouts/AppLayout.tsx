import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useParams, NavLink } from 'react-router-dom'
import {
  Search, ChevronsRight, MoreVertical, Plus, LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getUserWorkspaces,
  upsertWorkspace,
  deleteWorkspace,
  createWorkspace,
} from '../lib/storage'
import { getInitials } from '../lib/colors'
import Logo from '../components/Logo'
import UserAvatar from '../components/UserAvatar'
import AvatarPicker from '../components/AvatarPicker'
import PlanBadge from '../components/PlanBadge'
import { canCreateWorkspace } from '../lib/planLimits'
import { ensureUserIsOwner } from '../lib/members'
import { useData } from '../context/DataContext'
import NotificationsPanel, { NotificationBell, useNotificationCount } from '../components/NotificationsPanel'
import CommandPalette from '../components/CommandPalette'
import PendingInvitesBanner from '../components/PendingInvitesBanner'
import ThemeToggle from '../components/ThemeToggle'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import type { Workspace } from '../types'

export default function AppLayout() {
  const { user, logout, updateAvatar } = useAuth()
  const navigate = useNavigate()
  const { workspaceId } = useParams()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const { count: notificationCount, refresh: refreshNotificationCount } = useNotificationCount(
    user?.userId,
    user?.email,
  )
  const { online, localMode, cacheVersion, recoveryOffered, recoveryMessage, clearRecoveryMessage, tryRecoverData } = useData()
  const toast = useToast()
  const [recovering, setRecovering] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    if (!recoveryMessage) return
    if (recoveryMessage.startsWith('Restored')) toast.success(recoveryMessage)
    else toast.toast(recoveryMessage, 'info')
    clearRecoveryMessage()
  }, [recoveryMessage, clearRecoveryMessage, toast])

  function refreshWorkspaces() {
    if (user) setWorkspaces(getUserWorkspaces(user.userId, user.email))
  }

  useEffect(() => {
    refreshWorkspaces()
    refreshNotificationCount()
  }, [user, workspaceId, cacheVersion])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = workspaces.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()),
  )

  function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !newWorkspaceName.trim()) return
    const check = canCreateWorkspace(user.userId, user.email, user.plan)
    if (!check.ok) {
      alert(check.error)
      return
    }
    const workspace = createWorkspace(user.userId, newWorkspaceName.trim(), workspaces.length)
    upsertWorkspace(workspace)
    ensureUserIsOwner(workspace.id, user.userId, {
      id: user.userId,
      email: user.email,
      name: user.name,
    })
    const updated = getUserWorkspaces(user.userId, user.email)
    setWorkspaces(updated)
    setNewWorkspaceName('')
    setShowNewWorkspace(false)
    navigate(`/app/w/${workspace.id}`)
  }

  function handleDeleteWorkspace(id: string) {
    if (!confirm('Delete this workspace and all its databases?')) return
    deleteWorkspace(id)
    if (!user) return
    const updated = getUserWorkspaces(user.userId, user.email)
    setWorkspaces(updated)
    setMenuOpen(null)
    if (workspaceId === id) {
      navigate(updated[0] ? `/app/w/${updated[0].id}` : '/app')
    }
  }

  return (
    <div className="h-screen flex overflow-hidden bg-app-bg text-app-text">
      <aside
        className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 border-r border-app-border bg-app-surface flex flex-col transition-all duration-200`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-app-border">
          <Logo to="/app" light={theme === 'dark'} compact={collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-app-faint hover:text-app-muted transition-colors"
            aria-label="Toggle sidebar"
          >
            <ChevronsRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {collapsed && (
          <div className="p-2 border-b border-app-border flex flex-col items-center gap-2">
            <NotificationBell
              count={notificationCount}
              onClick={() => setShowNotifications(true)}
            />
          </div>
        )}

        {!collapsed && (
          <>
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-faint" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search workspaces… (⌘K for global)"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-app-input border border-app-border text-sm text-app-text placeholder:text-app-faint focus:outline-none focus:border-app-border-strong"
                />
              </div>
            </div>

            <div className="px-4 pb-2">
              <span className="text-[10px] font-semibold tracking-widest text-brand-400 uppercase">
                Workspaces
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
              {filtered.map((workspace) => (
                <div key={workspace.id} className="relative group">
                  <NavLink
                    to={`/app/w/${workspace.id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 pr-9 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-app-surface-active text-app-text'
                          : 'text-app-muted hover:bg-app-surface-hover hover:text-app-text'
                      }`
                    }
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: workspace.color }}
                    >
                      {getInitials(workspace.name)}
                    </div>
                    <span className="flex-1 truncate">{workspace.name}</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(menuOpen === workspace.id ? null : workspace.id)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 text-app-faint hover:text-app-muted transition-opacity ${
                      menuOpen === workspace.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label="Workspace options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen === workspace.id && (
                    <div className="absolute right-2 top-full z-20 mt-1 py-1 rounded-lg bg-app-surface-active border border-app-border-strong shadow-xl min-w-[120px]">
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkspace(workspace.id)}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-app-surface-hover"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-app-border">
              {showNewWorkspace ? (
                <form onSubmit={handleCreateWorkspace} className="space-y-2">
                  <input
                    autoFocus
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name"
                    className="w-full px-3 py-2 rounded-lg bg-app-input border border-app-border text-sm text-app-text placeholder:text-app-faint focus:outline-none focus:border-brand-500"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-1.5 rounded-lg bg-brand-500 text-xs font-medium hover:bg-brand-600">
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNewWorkspace(false); setNewWorkspaceName('') }}
                      className="flex-1 py-1.5 rounded-lg border border-app-border text-xs text-app-muted hover:bg-app-surface-hover"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewWorkspace(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-brand-500/50 text-brand-400 text-sm font-medium hover:bg-brand-500/10 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Workspace
                </button>
              )}
            </div>

            <div className="p-3 border-t border-app-border flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAvatarPicker(true)}
                className="shrink-0 rounded-full hover:ring-2 hover:ring-brand-500/50 transition-shadow"
                aria-label="Change profile picture"
              >
                <UserAvatar
                  name={user?.name ?? '?'}
                  emoji={user?.avatarEmoji}
                />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-app-text truncate">{user?.name}</p>
                {user && <PlanBadge planId={user.plan} className="mt-1" />}
              </div>
              <ThemeToggle compact />
              <NotificationBell
                count={notificationCount}
                onClick={() => setShowNotifications(true)}
              />
              <button
                type="button"
                onClick={() => { logout(); navigate('/') }}
                className="p-1.5 text-app-faint hover:text-app-muted"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {localMode && (
          <div className="shrink-0 px-4 py-2 bg-brand-900/40 border-b border-brand-800/50 text-xs text-brand-200 text-center">
            Local demo mode — data is saved in your browser. Add Firebase env vars when you&apos;re ready to deploy.
          </div>
        )}
        {!localMode && !online && (
          <div className="shrink-0 px-4 py-2 bg-amber-900/40 border-b border-amber-800/50 text-xs text-amber-200 text-center">
            You&apos;re offline. Cached data is available and changes will sync when you reconnect.
          </div>
        )}
        {recoveryOffered && (
          <div className="shrink-0 px-4 py-2 bg-app-surface border-b border-app-border text-xs text-app-muted flex items-center justify-between gap-3">
            <span>Missing records? SheetFlow can scan this browser and offline cache for older copies.</span>
            <button
              type="button"
              disabled={recovering}
              onClick={async () => {
                setRecovering(true)
                try {
                  await tryRecoverData()
                } finally {
                  setRecovering(false)
                }
              }}
              className="shrink-0 px-3 py-1.5 rounded-md bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 disabled:opacity-60"
            >
              {recovering ? 'Scanning…' : 'Restore records'}
            </button>
          </div>
        )}
        {user && (
          <PendingInvitesBanner
            onUpdate={() => {
              refreshNotificationCount()
              refreshWorkspaces()
            }}
          />
        )}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>

      {showNotifications && user && (
        <NotificationsPanel
          onClose={() => setShowNotifications(false)}
          onUpdate={() => {
            refreshNotificationCount()
            refreshWorkspaces()
          }}
        />
      )}

      <CommandPalette open={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {showAvatarPicker && user && (
        <AvatarPicker
          name={user.name}
          currentEmoji={user.avatarEmoji}
          onClose={() => setShowAvatarPicker(false)}
          onSave={(emoji) => {
            updateAvatar(emoji)
            setShowAvatarPicker(false)
          }}
        />
      )}
    </div>
  )
}
