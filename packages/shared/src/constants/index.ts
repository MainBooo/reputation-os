export const QUEUE_NAMES = {
  SOURCE_DISCOVERY: 'source_discovery',
  REVIEWS_SYNC: 'reviews_sync',
  MENTIONS_SYNC: 'mentions_sync',
  RATING_REFRESH: 'rating_refresh',
  RECONCILE: 'reconcile',
  NOTIFICATIONS: 'notifications',
  VK_BRAND_SEARCH_DISCOVERY: 'vk_brand_search_discovery',
  VK_PRIORITY_COMMUNITIES_SYNC: 'vk_priority_communities_sync',
  VK_OWNED_COMMUNITY_SYNC: 'vk_owned_community_sync',
  VK_COMMENTS_SYNC: 'vk_comments_sync',
  VK_BRAND_MATCH: 'vk_brand_match',
  VK_RECONCILE: 'vk_reconcile'
} as const

export const JOB_NAMES = {
  SOURCE_DISCOVERY: 'source.discovery',
  REVIEWS_SYNC: 'reviews.sync',
  MENTIONS_SYNC: 'mentions.sync',
  RATING_REFRESH: 'rating.refresh',
  RECONCILE: 'reconcile.run',
  NOTIFICATIONS: 'notifications.evaluate',
  VK_BRAND_SEARCH: 'vk.brand-search',
  VK_PRIORITY_COMMUNITIES: 'vk.priority-communities',
  VK_OWNED_COMMUNITY: 'vk.owned-community',
  VK_COMMENTS: 'vk.comments',
  VK_BRAND_MATCH: 'vk.brand-match',
  VK_RECONCILE: 'vk.reconcile'
} as const
