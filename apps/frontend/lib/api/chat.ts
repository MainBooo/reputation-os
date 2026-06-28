import { apiFetch } from './client'

export interface ChatAuthor {
  id: string
  email?: string | null
  fullName?: string | null
}

export interface ChatMessage {
  id: string
  threadId: string
  workspaceId: string
  authorId: string
  body: string
  type: 'TEXT' | 'SYSTEM'
  editedAt?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
  author: ChatAuthor
}

export interface ChatThread {
  id: string
  type: 'WORKSPACE' | 'COMPANY' | 'MENTION'
  title?: string | null
  workspaceId: string
  companyId?: string | null
  mentionId?: string | null
  isArchived: boolean
  lastMessageAt?: string | null
  createdAt: string
  company?: { id: string; name: string } | null
  mention?: { id: string; preview: string; platform: string } | null
  lastMessage?: ChatMessage | null
  unreadCount: number
}

export interface MessagesResponse {
  messages: ChatMessage[]
  nextCursor: string | null
}

export function getThreads(workspaceId: string, params?: { type?: string; companyId?: string; mentionId?: string }) {
  const qs = new URLSearchParams({ workspaceId })
  if (params?.type) qs.set('type', params.type)
  if (params?.companyId) qs.set('companyId', params.companyId)
  if (params?.mentionId) qs.set('mentionId', params.mentionId)
  return apiFetch<ChatThread[]>(`/chat/threads?${qs}`, undefined, [])
}

export function getThread(threadId: string, workspaceId: string) {
  return apiFetch<ChatThread>(`/chat/threads/${threadId}?workspaceId=${workspaceId}`)
}

export function getMessages(threadId: string, workspaceId: string, cursor?: string, limit = 50) {
  const qs = new URLSearchParams({ workspaceId, limit: String(limit) })
  if (cursor) qs.set('cursor', cursor)
  return apiFetch<MessagesResponse>(`/chat/threads/${threadId}/messages?${qs}`)
}

export function createThread(payload: {
  workspaceId: string
  type: 'WORKSPACE' | 'COMPANY' | 'MENTION'
  companyId?: string
  mentionId?: string
  title?: string
}) {
  return apiFetch<ChatThread>('/chat/threads', { method: 'POST', body: JSON.stringify(payload) })
}

export function sendMessage(threadId: string, workspaceId: string, body: string) {
  return apiFetch<ChatMessage>(`/chat/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ workspaceId, body })
  })
}

export function editMessage(messageId: string, workspaceId: string, body: string) {
  return apiFetch<ChatMessage>(`/chat/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ workspaceId, body })
  })
}

export function deleteMessage(messageId: string, workspaceId: string) {
  return apiFetch(`/chat/messages/${messageId}?workspaceId=${workspaceId}`, { method: 'DELETE' })
}

export function markThreadRead(threadId: string, workspaceId: string) {
  return apiFetch(`/chat/threads/${threadId}/read`, {
    method: 'POST',
    body: JSON.stringify({ workspaceId })
  })
}

export function getUnreadCount(workspaceId: string) {
  return apiFetch<{ unreadCount: number }>(`/chat/unread-count?workspaceId=${workspaceId}`, undefined, { unreadCount: 0 })
}

export function getOrCreateCompanyThread(companyId: string, workspaceId: string) {
  return apiFetch<ChatThread>(`/chat/company/${companyId}/thread?workspaceId=${workspaceId}`)
}

export function getOrCreateMentionThread(mentionId: string, workspaceId: string) {
  return apiFetch<ChatThread>(`/chat/mention/${mentionId}/thread?workspaceId=${workspaceId}`)
}
