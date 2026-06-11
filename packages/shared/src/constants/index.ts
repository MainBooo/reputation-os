export const QUEUE_NAMES = {
  SOURCE_DISCOVERY: 'source_discovery',
  REVIEWS_SYNC: 'reviews_sync',
  MENTIONS_SYNC: 'mentions_sync',
  RATING_REFRESH: 'rating_refresh',
  RECONCILE: 'reconcile',
  NOTIFICATIONS: 'notifications',
} as const

export const JOB_NAMES = {
  SOURCE_DISCOVERY: 'source.discovery',
  REVIEWS_SYNC: 'reviews.sync',
  MENTIONS_SYNC: 'mentions.sync',
  RATING_REFRESH: 'rating.refresh',
  RECONCILE: 'reconcile.run',
  NOTIFICATIONS: 'notifications.evaluate',
} as const
