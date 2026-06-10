import { useAuth } from '../context/AuthContext'
import { useInviteCount } from '../components/NotificationsPanel'

export default function EmptyHomePage() {
  const { user } = useAuth()
  const { count: inviteCount } = useInviteCount(user?.userId, user?.email)

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-app-text">
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-3 text-sm text-app-muted leading-relaxed">
          Your workspace is empty. Create a new workspace from the sidebar
          {inviteCount > 0
            ? ', or accept a pending invite from the banner at the top of the page.'
            : '.'}
        </p>
      </div>
    </div>
  )
}
