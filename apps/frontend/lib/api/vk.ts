import { apiFetch } from './client'
import type { VkOverviewResponse } from '../types'

export type CreateVkSearchProfileInput = {
  query: string
  priority?: number
  isActive?: boolean
  mode: 'BRAND_SEARCH' | 'PRIORITY_COMMUNITIES' | 'OWNED_COMMUNITY'
}

export type CreateVkCommunityInput = {
  mode: 'PRIORITY_COMMUNITY' | 'OWNED_COMMUNITY'
  vkCommunityId: string
  screenName?: string
  title?: string
  url?: string
  isActive?: boolean
}

export function getVkOverview(id: string) {
  return apiFetch<VkOverviewResponse>(`/companies/${id}/vk/overview`, undefined, {
    trackedCommunitiesCount: 0,
    activeSearchProfilesCount: 0,
    discoveredVkPostsCount: 0,
    relevantVkMentionsCount: 0,
    recentPosts: [],
    recentMentions: []
  })
}

export function getVkSearchProfiles(id: string) {
  return apiFetch(`/companies/${id}/vk/search-profiles`, undefined, [])
}

export function getVkCommunities(id: string) {
  return apiFetch(`/companies/${id}/vk/communities`, undefined, [])
}

export function getVkPosts(id: string) {
  return apiFetch(`/companies/${id}/vk/posts`, undefined, [])
}

export function createVkSearchProfile(id: string, payload: CreateVkSearchProfileInput) {
  return apiFetch(`/companies/${id}/vk/search-profiles`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function deleteVkSearchProfile(id: string, profileId: string) {
  return apiFetch(`/companies/${id}/vk/search-profiles/${profileId}`, {
    method: 'DELETE'
  })
}

export function createVkCommunity(id: string, payload: CreateVkCommunityInput) {
  return apiFetch(`/companies/${id}/vk/communities`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function runBrandSearch(id: string) {
  return apiFetch(`/companies/${id}/vk/run-brand-search`, { method: 'POST' }, { ok: true })
}

export function runCommunitySync(id: string) {
  return apiFetch(`/companies/${id}/vk/run-community-sync`, { method: 'POST' }, { ok: true })
}

export function runOwnedCommunitySync(id: string) {
  return apiFetch(`/companies/${id}/vk/run-owned-community-sync`, { method: 'POST' }, { ok: true })
}
