import type { PlanId, Workspace, WorkspaceMember } from '../types'
import { assignUserPlan, getResolvedPlan } from './storage'

export function canManageUserPlans(
  workspace: Pick<Workspace, 'ownerId'>,
  userId: string,
): boolean {
  return workspace.ownerId === userId
}

export function getMemberPlan(member: WorkspaceMember): PlanId {
  return getResolvedPlan(member.userId, member.email)
}

export function updateMemberPlan(member: WorkspaceMember, plan: PlanId) {
  return assignUserPlan(member.userId, member.email, plan, true)
}
