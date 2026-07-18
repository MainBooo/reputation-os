export const JOBS = {
  SOURCE_DISCOVERY: 'source.discovery',
  REVIEWS_SYNC: 'reviews.sync',
  MENTIONS_SYNC: 'mentions.sync',
  RATING_REFRESH: 'rating.refresh',
  RECONCILE: 'reconcile.run',
  NOTIFICATIONS: 'notifications.evaluate',
  ALERT_CHECK: 'alerts.check',
  PAGE_WATCH: 'page.watch',
  PAGE_WATCH_DISPATCHER: 'page.watch.dispatcher',
  SUBSCRIPTION_REMINDER: 'subscription.reminder.check',
  DEEP_SCAN_PROMOTE: 'deep.scan.promote',
  TELEGRAM_DISCOVERY: 'telegram.discovery',
  TELEGRAM_WATCHLIST: 'telegram.watchlist',
  TELEGRAM_ENTITY_SEARCH: 'telegram.entity_search',
  TELEGRAM_SOURCE_CHECK: 'telegram.source_check',
  TELEGRAM_WATCHLIST_DISPATCHER: 'telegram.watchlist.dispatcher'
} as const
