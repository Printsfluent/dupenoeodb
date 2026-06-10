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
import { useData } from '../context/DataContext'
import NotificationsPanel, { NotificationBell, useInviteCount } from '../components/NotificationsPanel'
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
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const { count: inviteCount, refresh: refreshInviteCount } = useInviteCount(user?.userId, user?.email)
  const { online, localMode, cacheVersion } = useData()

  function refreshWorkspaces() {
    if (user) setWorkspaces(getUserWorkspaces(user.userId, user.email))
  }

  useEffect(() => {
    refreshWorkspaces()
    refreshInviteCount()
  }, [user, workspaceId, cacheVersion])

  useEffect(() => {
    if (!user || workspaceId || workspaces.length === 0) return
    navigate(`/app/w/${workspaces[0].id}`, { replace: true })
  }, [user, workspaceId, workspaces, navigate])

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
    const updated = getUserWorkspaces(user.userId, user.email)
    setWorkspaces(updated)
    setNewWorkspaceName('')
    setShowNewWorkspace(false)
    navigate(`/app/w/${workspace.id}`)
  }

  function handleDeleteWorkspace(id: string) {
    if (!confirm('Delete this workspace and all its bases?')) return
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
    <div className="min-h-screen flex bg-[#111111] text-white">
      <aside
        className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 border-r border-[#2a2a2a] flex flex-col transition-all duration-200`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a2a2a]">
          <Logo to="/app" light compact={collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <ChevronsRight className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {!collapsed && (
          <>
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search workspaces and bas..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-[#3a3a3a]"
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
                          ? 'bg-[#2a2a2a] text-white'
                          : 'text-gray-400 hover:bg-[#1e1e1e] hover:text-gray-200'
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
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-gray-400 transition-opacity ${
                      menuOpen === workspace.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label="Workspace options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen === workspace.id && (
                    <div className="absolute right-2 top-full z-20 mt-1 py-1 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] shadow-xl min-w-[120px]">
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkspace(workspace.id)}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-[#333]"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-[#2a2a2a]">
              {showNewWorkspace ? (
                <form onSubmit={handleCreateWorkspace} className="space-y-2">
                  <input
                    autoFocus
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-1.5 rounded-lg bg-brand-500 text-xs font-medium hover:bg-brand-600">
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNewWorkspace(false); setNewWorkspaceName('') }}
                      className="flex-1 py-1.5 rounded-lg border border-[#2a2a2a] text-xs text-gray-400 hover:bg-[#1e1e1e]"
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

            <div className="p-3 border-t border-[#2a2a2a] flex items-center gap-3">
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
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                {user && <PlanBadge planId={user.plan} className="mt-1" />}
              </div>
              <NotificationBell
                count={inviteCount}
                onClick={() => setShowNotifications(true)}
              />
              <button
                type="button"
                onClick={() => { logout(); navigate('/') }}
                className="p-1.5 text-gray-500 hover:text-gray-300"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
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
        <Outlet />
      </div>

      {showNotifications && user && (
        <NotificationsPanel
          onClose={() => setShowNotifications(false)}
          onUpdate={() => {
            refreshInviteCount()
            refreshWorkspaces()
          }}
        />
      )}

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
