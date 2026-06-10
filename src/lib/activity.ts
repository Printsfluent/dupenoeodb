import type { ActivityAction, ActivityEvent } from '../types'
import { createId } from './id'
import { getCache, setActivityEvents } from './dataStore'
import { persistActivityEvent } from './firestoreSync'

export function getWorkspaceActivity(workspaceId: string): ActivityEvent[] {
  return getCache()
    .activityEvents.filter((event) => event.workspaceId === workspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function logActivity(input: {
  workspaceId: string
  action: ActivityAction
  actorId: string
  actorName: string
  targetLabel: string
}) {
  const event: ActivityEvent = {
    id: createId(),
    workspaceId: input.workspaceId,
    action: input.action,
    actorId: input.actorId,
    actorName: input.actorName,
    targetLabel: input.targetLabel,
    createdAt: new Date().toISOString(),
  }
  setActivityEvents([event])
  void persistActivityEvent(event)
  return event
}
