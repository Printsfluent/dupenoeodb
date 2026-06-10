import { useCallback, useEffect, useState } from 'react'
import { useData } from '../context/DataContext'
import { getPendingInviteCount } from '../lib/invites'
import { getNotificationsForUser, getUnreadNotificationCount } from '../lib/notifications'

export function useNotificationCount(userId: string | undefined, email: string | undefined) {
  const { cacheVersion } = useData()
  const [count, setCount] = useState(0)

  const refresh = useCallback(() => {
    if (!userId || !email) {
      setCount(0)
      return
    }
    const invites = getPendingInviteCount(userId, email)
    const unread = getUnreadNotificationCount(userId)
    setCount(invites + unread)
  }, [userId, email])

  useEffect(() => {
    refresh()
  }, [refresh, cacheVersion])

  return { count, refresh }
}

export function useAppNotifications(userId: string | undefined) {
  const { cacheVersion } = useData()
  const [items, setItems] = useState(() => (userId ? getNotificationsForUser(userId) : []))

  useEffect(() => {
    setItems(userId ? getNotificationsForUser(userId) : [])
  }, [userId, cacheVersion])

  return items
}
