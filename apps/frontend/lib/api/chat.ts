import { apiFetch } from './client'

export interface ChatAuthor {
  id: string
  email?: string | null
  fullName?: string | null
}

export interface ChatMessage {
  id: string
  threadId: string
  workspaceId?: string | null
  authorId: string
  body: string
  type: 'TEXT' | 'SYSTEM'
  editedAt?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
  author: ChatAuthor
}

export interface ChatParticipant {
  userId: string
  user: ChatAuthor
}

export interface ChatThread {
  id: string
  type: 'WORKSPACE' | 'COMPANY' | 'MENTION' | 'DIRECT'
  title?: string | null
  workspaceId?: string | null
  companyId?: string | null
  mentionId?: string | null
  isArchived: boolean
  lastMessageAt?: string | null
  createdAt: string
  company?: { id: string; name: string } | null
  mention?: { id: string; preview: string; platform: string } | null
  participants?: ChatParticipant[] | null
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

export function getMessages(threadId: string, workspaceId: string | null | undefined, cursor?: string, limit = 50) {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (workspaceId) qs.set('workspaceId', workspaceId)
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

export function createDirectChat(email: string) {
  return apiFetch<ChatThread>('/chat/direct', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
}

export function sendMessage(threadId: string, workspaceId: string | null | undefined, body: string) {
  return apiFetch<ChatMessage>(`/chat/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ workspaceId: workspaceId || undefined, body })
  })
}

export function editMessage(messageId: string, workspaceId: string | null | undefined, body: string) {
  return apiFetch<ChatMessage>(`/chat/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ workspaceId: workspaceId || undefined, body })
  })
}

export function deleteMessage(messageId: string, workspaceId: string | null | undefined) {
  const qs = workspaceId ? `?workspaceId=${workspaceId}` : ''
  return apiFetch(`/chat/messages/${messageId}${qs}`, { method: 'DELETE' })
}

export function markThreadRead(threadId: string, workspaceId: string | null | undefined) {
  return apiFetch(`/chat/threads/${threadId}/read`, {
    method: 'POST',
    body: JSON.stringify({ workspaceId: workspaceId || undefined })
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

export function getDirectPartner(thread: ChatThread, currentUserId: string): ChatAuthor | null {
  if (thread.type !== 'DIRECT' || !thread.participants) return null
  const other = thread.participants.find((p) => p.userId !== currentUserId)
  return other?.user ?? null
}
