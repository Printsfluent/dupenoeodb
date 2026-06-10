import type { AppNotification, NotificationType } from '../types'
import { createId } from './id'
import { getCache, setAppNotifications } from './dataStore'
import { persistAppNotification } from './firestoreSync'

export function getNotificationsForUser(userId: string): AppNotification[] {
  return getCache()
    .appNotifications.filter((item) => item.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getUnreadNotificationCount(userId: string): number {
  return getNotificationsForUser(userId).filter((item) => !item.read).length
}

export function createAppNotification(input: {
  userId: string
  type: NotificationType
  title: string
  body: string
  href?: string
}) {
  const notification: AppNotification = {
    id: createId(),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
    read: false,
    createdAt: new Date().toISOString(),
  }
  setAppNotifications([notification])
  void persistAppNotification(notification)
  return notification
}

export function markNotificationRead(notificationId: string) {
  const notification = getCache().appNotifications.find((item) => item.id === notificationId)
  if (!notification || notification.read) return
  const updated = { ...notification, read: true }
  setAppNotifications([updated])
  void persistAppNotification(updated)
}

export function markAllNotificationsRead(userId: string) {
  const unread = getNotificationsForUser(userId).filter((item) => !item.read)
  if (unread.length === 0) return
  unread.forEach((item) => markNotificationRead(item.id))
}
