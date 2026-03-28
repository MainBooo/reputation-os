# Patch notes

## Final delivery notes

- No entity renames introduced.
- VK 3-mode architecture preserved.
- Queue names preserved:
  - source_discovery
  - reviews_sync
  - mentions_sync
  - rating_refresh
  - reconcile
  - notifications
  - vk_brand_search_discovery
  - vk_priority_communities_sync
  - vk_owned_community_sync
  - vk_comments_sync
  - vk_brand_match
  - vk_reconcile

## Areas intentionally demo/hybrid
- external source adapters
- real AI provider integration
- notification delivery provider
- real VK token-based API integration

## Replace later without changing architecture
- adapters internals
- reply generation provider
- notification transport implementation
- auth/session hardening
