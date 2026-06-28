'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { getUnreadCount } from '@/lib/api/chat'
import type { ChatMessage } from '@/lib/api/chat'

interface ChatContextValue {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
  selectedThreadId: string | null
  setSelectedThreadId: (id: string | null) => void
  workspaceId: string
  setWorkspaceId: (id: string) => void
  unreadCount: number
  refreshUnread: () => void
  onMessage: (handler: (msg: ChatMessage & { threadId: string }) => void) => () => void
  onMessageUpdated: (handler: (data: { threadId: string; message: ChatMessage }) => void) => () => void
  onMessageDeleted: (handler: (data: { threadId: string; messageId: string }) => void) => () => void
  onUnreadUpdated: (handler: (data: { workspaceId: string; threadId: string }) => void) => () => void
  joinThread: (threadId: string) => void
  leaveThread: (threadId: string) => void
  sendTyping: (threadId: string, typing: boolean) => void
  onTyping: (handler: (data: { threadId: string; userId: string; typing: boolean }) => void) => () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used inside ChatProvider')
  return ctx
}

function readToken() {
  if (typeof window === 'undefined') return ''
  const cookie = document.cookie.split('; ').find((r) => r.startsWith('accessToken='))?.split('=')[1]
  if (cookie) return decodeURIComponent(cookie)
  try { return localStorage.getItem('accessToken') || '' } catch { return '' }
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const socketRef = useRef<Socket | null>(null)

  // Event handler registries
  const msgHandlers = useRef<Set<(msg: ChatMessage & { threadId: string }) => void>>(new Set())
  const msgUpdatedHandlers = useRef<Set<(d: { threadId: string; message: ChatMessage }) => void>>(new Set())
  const msgDeletedHandlers = useRef<Set<(d: { threadId: string; messageId: string }) => void>>(new Set())
  const unreadHandlers = useRef<Set<(d: { workspaceId: string; threadId: string }) => void>>(new Set())
  const typingHandlers = useRef<Set<(d: { threadId: string; userId: string; typing: boolean }) => void>>(new Set())

  const refreshUnread = useCallback(() => {
    if (!workspaceId) return
    getUnreadCount(workspaceId).then((r) => setUnreadCount(r.unreadCount)).catch(() => {})
  }, [workspaceId])

  // Unread polling fallback (every 30s)
  useEffect(() => {
    if (!workspaceId) return
    refreshUnread()
    const interval = setInterval(refreshUnread, 30000)
    return () => clearInterval(interval)
  }, [workspaceId, refreshUnread])

  // Socket connection
  useEffect(() => {
    const token = readToken()
    if (!token) return

    const wsUrl = typeof window !== 'undefined' ? window.location.origin : ''
    if (!wsUrl) return

    const socket = io(wsUrl, {
      path: '/api/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000
    })

    socketRef.current = socket

    socket.on('chat:message_created', (data: { threadId: string; message: ChatMessage }) => {
      msgHandlers.current.forEach((h) => h({ ...data.message, threadId: data.threadId }))
    })

    socket.on('chat:message_updated', (data: { threadId: string; message: ChatMessage }) => {
      msgUpdatedHandlers.current.forEach((h) => h(data))
    })

    socket.on('chat:message_deleted', (data: { threadId: string; messageId: string }) => {
      msgDeletedHandlers.current.forEach((h) => h(data))
    })

    socket.on('chat:unread_updated', (data: { workspaceId: string; threadId: string }) => {
      unreadHandlers.current.forEach((h) => h(data))
      refreshUnread()
    })

    socket.on('chat:typing_started', (data: { threadId: string; userId: string }) => {
      typingHandlers.current.forEach((h) => h({ ...data, typing: true }))
    })

    socket.on('chat:typing_stopped', (data: { threadId: string; userId: string }) => {
      typingHandlers.current.forEach((h) => h({ ...data, typing: false }))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const joinThread = useCallback((threadId: string) => {
    socketRef.current?.emit('chat:join_thread', { threadId, workspaceId })
  }, [workspaceId])

  const leaveThread = useCallback((threadId: string) => {
    socketRef.current?.emit('chat:leave_thread', { threadId })
  }, [])

  const sendTyping = useCallback((threadId: string, typing: boolean) => {
    const event = typing ? 'chat:typing_started' : 'chat:typing_stopped'
    socketRef.current?.emit(event, { threadId })
  }, [])

  const onMessage = useCallback((h: (msg: ChatMessage & { threadId: string }) => void) => {
    msgHandlers.current.add(h)
    return () => { msgHandlers.current.delete(h) }
  }, [])

  const onMessageUpdated = useCallback((h: (d: { threadId: string; message: ChatMessage }) => void) => {
    msgUpdatedHandlers.current.add(h)
    return () => { msgUpdatedHandlers.current.delete(h) }
  }, [])

  const onMessageDeleted = useCallback((h: (d: { threadId: string; messageId: string }) => void) => {
    msgDeletedHandlers.current.add(h)
    return () => { msgDeletedHandlers.current.delete(h) }
  }, [])

  const onUnreadUpdated = useCallback((h: (d: { workspaceId: string; threadId: string }) => void) => {
    unreadHandlers.current.add(h)
    return () => { unreadHandlers.current.delete(h) }
  }, [])

  const onTyping = useCallback((h: (d: { threadId: string; userId: string; typing: boolean }) => void) => {
    typingHandlers.current.add(h)
    return () => { typingHandlers.current.delete(h) }
  }, [])

  return (
    <ChatContext.Provider value={{
      isOpen,
      openChat: () => setIsOpen(true),
      closeChat: () => setIsOpen(false),
      selectedThreadId,
      setSelectedThreadId,
      workspaceId,
      setWorkspaceId,
      unreadCount,
      refreshUnread,
      onMessage,
      onMessageUpdated,
      onMessageDeleted,
      onUnreadUpdated,
      joinThread,
      leaveThread,
      sendTyping,
      onTyping
    }}>
      {children}
    </ChatContext.Provider>
  )
}
