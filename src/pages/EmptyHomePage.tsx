import { useAuth } from '../context/AuthContext'
import { useInviteCount } from '../components/NotificationsPanel'

export default function EmptyHomePage() {
  const { user } = useAuth()
  const { count: inviteCount } = useInviteCount(user?.userId, user?.email)

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-white">
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          Your workspace is empty. Create a new workspace from the sidebar, or accept a workspace invite
          from the bell icon{inviteCount > 0 ? ` (${inviteCount} pending)` : ''}.
        </p>
      </div>
    </div>
  )
}
