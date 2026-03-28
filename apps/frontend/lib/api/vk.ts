import { apiFetch } from './client'
import type { VkOverviewResponse } from '../types'

export function getVkOverview(id: string) {
  return apiFetch<VkOverviewResponse>(`/companies/${id}/vk/overview`, undefined, {
    trackedCommunitiesCount: 2,
    activeSearchProfilesCount: 2,
    discoveredVkPostsCount: 4,
    relevantVkMentionsCount: 3,
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

export function runBrandSearch(id: string) {
  return apiFetch(`/companies/${id}/vk/run-brand-search`, { method: 'POST' }, { ok: true })
}

export function runCommunitySync(id: string) {
  return apiFetch(`/companies/${id}/vk/run-community-sync`, { method: 'POST' }, { ok: true })
}

export function runOwnedCommunitySync(id: string) {
  return apiFetch(`/companies/${id}/vk/run-owned-community-sync`, { method: 'POST' }, { ok: true })
}
