import type { MessageClassificationType, MessageClassifierDecision, MessageRoutingResult } from './telegram-scout.types'

/** Only these types are ever eligible to be hidden from the Inbox — every other
 *  type (reviews, complaints, questions, chat discussion, news) stays visible
 *  regardless of confidence, just without the "needs review" badge once confident. */
const HIDE_ELIGIBLE_TYPES = new Set<MessageClassificationType>(['OWNED_PROMO', 'IRRELEVANT', 'SPAM'])

/** Pure threshold function — no side effects, so the boundary values (0.79/0.80/
 *  0.89/0.90/0.91) can be unit-tested directly. `type: null, confidence: 0` is the
 *  convention callers use for a technical classifier failure (ok:false); it falls
 *  straight into the low-confidence branch below, so no special-casing is needed
 *  here to guarantee `{isInboxVisible:true, needsManualReview:true}` on failure.
 *  `decision === 'UNSURE'` is a separate hard guard: the model itself said it could
 *  not confidently decide, so auto-hide never applies regardless of type/confidence
 *  — that would silently discard a message the model flagged as ambiguous. */
export function resolveMessageRouting(
  type: MessageClassificationType | null,
  confidence: number,
  thresholds: { reviewThreshold: number; hideThreshold: number },
  decision: MessageClassifierDecision | null = null
): MessageRoutingResult {
  if (confidence < thresholds.reviewThreshold) {
    return { isInboxVisible: true, needsManualReview: true }
  }

  if (decision === 'UNSURE') {
    return { isInboxVisible: true, needsManualReview: false }
  }

  if (confidence >= thresholds.hideThreshold && type !== null && HIDE_ELIGIBLE_TYPES.has(type)) {
    return { isInboxVisible: false, needsManualReview: false }
  }

  return { isInboxVisible: true, needsManualReview: false }
}
