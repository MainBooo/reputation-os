import { apiFetch } from './client'

export interface TelegramChannelDto {
  id: string
  chatId: string
  username: string | null
  title: string | null
  entityType: string
  enabled: boolean
  discoveryMethod: string
  matchedQuery: string | null
  checkIntervalMin: number
  nextCheckAt: string | null
  lastCheckedAt: string | null
  consecutiveErrors: number
  lastError: string | null
  lastDecisionReason: string | null
  relevanceScore: number | null
  mentionsFoundCount: number
  createdAt: string
  updatedAt: string
}

export interface TelegramScoutStatus {
  companyId: string
  latestLog: {
    jobStatus: string
    startedAt: string | null
    finishedAt: string | null
    errorMessage: string | null
    result: Record<string, unknown> | null
  } | null
  watchlistEnabledCount: number
  watchlistTotalCount: number
  totalMentionsFound: number
}

export function getTelegramChannels(companyId: string) {
  return apiFetch<TelegramChannelDto[]>(`/companies/${companyId}/telegram-channels`, undefined, [])
}

export function createTelegramChannel(companyId: string, username: string) {
  return apiFetch(`/companies/${companyId}/telegram-channels`, {
    method: 'POST',
    body: JSON.stringify({ username })
  })
}

export function updateTelegramChannel(
  companyId: string,
  channelId: string,
  payload: { enabled?: boolean; checkIntervalMin?: number }
) {
  return apiFetch(`/companies/${companyId}/telegram-channels/${channelId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function deleteTelegramChannel(companyId: string, channelId: string) {
  return apiFetch(`/companies/${companyId}/telegram-channels/${channelId}`, {
    method: 'DELETE'
  })
}

export function checkTelegramChannelNow(companyId: string, channelId: string) {
  return apiFetch(`/companies/${companyId}/telegram-channels/${channelId}/check`, {
    method: 'POST'
  })
}

export function startTelegramSync(companyId: string) {
  return apiFetch(`/companies/${companyId}/start-telegram-sync`, {
    method: 'POST'
  })
}

export function getTelegramScoutStatus(companyId: string) {
  return apiFetch<TelegramScoutStatus>(`/companies/${companyId}/telegram-scout/status`)
}
