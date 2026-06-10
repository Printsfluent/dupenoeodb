export const WORKSPACE_COLORS = [
  '#3b82f6',
  '#ec4899',
  '#f97316',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#eab308',
]

export function pickWorkspaceColor(index: number) {
  return WORKSPACE_COLORS[index % WORKSPACE_COLORS.length]
}

export function getInitials(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}
