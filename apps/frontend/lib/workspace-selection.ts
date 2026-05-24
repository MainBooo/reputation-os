export const WORKSPACE_QUERY_KEY = 'workspaceId'
export const WORKSPACE_STORAGE_KEY = 'reputation:selectedWorkspaceId'

export function pickWorkspaceId(workspaces: any[], requested?: string | null) {
  if (!Array.isArray(workspaces) || !workspaces.length) return ''
  if (requested && workspaces.some((item) => item?.id === requested)) return requested
  return workspaces[0]?.id || ''
}

export function filterByWorkspace<T extends { workspaceId?: string | null }>(items: T[], workspaceId?: string | null) {
  if (!workspaceId) return items
  return items.filter((item) => item.workspaceId === workspaceId)
}
