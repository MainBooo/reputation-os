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

export type VkCompanySearchProfileResponse = {
  includeKeywords: string[]
  excludeKeywords: string[]
  contextKeywords: string[]
  geoKeywords: string[]
  category: string | null
}

export type UpdateVkCompanySearchProfileInput = {
  includeKeywords: string[]
  excludeKeywords: string[]
  contextKeywords: string[]
  geoKeywords: string[]
  category: string | null
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

export function getVkCompanySearchProfile(id: string) {
  return apiFetch<VkCompanySearchProfileResponse>(`/companies/${id}/vk/search-profile`, undefined, {
    includeKeywords: [],
    excludeKeywords: [],
    contextKeywords: [],
    geoKeywords: [],
    category: null
  })
}

export function updateVkCompanySearchProfile(id: string, payload: UpdateVkCompanySearchProfileInput) {
  return apiFetch<VkCompanySearchProfileResponse>(`/companies/${id}/vk/search-profile`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function runVkPostSearch(id: string) {
  return apiFetch(`/companies/${id}/vk/search-posts`, { method: 'POST' }, { ok: true, jobId: null, queue: 'vk_post_search' })
}

export function getVkPostSearchRuns(id: string) {
  return apiFetch(`/companies/${id}/vk/search-runs`, undefined, [])
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
