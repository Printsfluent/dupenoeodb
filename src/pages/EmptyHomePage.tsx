import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { getUserWorkspaces } from '../lib/storage'
import { useInviteCount } from '../components/NotificationsPanel'

export default function EmptyHomePage() {
  const { user } = useAuth()
  const { ready, cacheVersion } = useData()
  const { count: inviteCount } = useInviteCount(user?.userId, user?.email)

  const workspaces = useMemo(
    () => (user ? getUserWorkspaces(user.userId, user.email) : []),
    [user, cacheVersion],
  )

  if (user && workspaces.length > 0) {
    return <Navigate to={`/app/w/${workspaces[0].id}`} replace />
  }

  if (!ready || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-app-text">
          Welcome{user.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-3 text-sm text-app-muted leading-relaxed">
          You don&apos;t have any workspaces yet. Create one from the sidebar
          {inviteCount > 0
            ? ', or accept a pending invite from the banner at the top of the page.'
            : '.'}
        </p>
      </div>
    </div>
  )
}
