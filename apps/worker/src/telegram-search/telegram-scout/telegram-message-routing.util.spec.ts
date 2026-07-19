import { resolveMessageRouting } from './telegram-message-routing.util'
import type { MessageClassificationType } from './telegram-scout.types'

const THRESHOLDS = { reviewThreshold: 0.8, hideThreshold: 0.9 }

const ALL_TYPES: MessageClassificationType[] = [
  'OWNED_PROMO',
  'CUSTOMER_REVIEW',
  'CUSTOMER_COMPLAINT',
  'CUSTOMER_QUESTION',
  'CHAT_DISCUSSION',
  'NEWS_MENTION',
  'IRRELEVANT',
  'SPAM'
]

const HIDE_ELIGIBLE: MessageClassificationType[] = ['OWNED_PROMO', 'IRRELEVANT', 'SPAM']

describe('resolveMessageRouting', () => {
  describe('below the review threshold — always visible + needs review, regardless of type', () => {
    it.each(ALL_TYPES)('%s at confidence 0.79 -> visible, needs review', (type) => {
      expect(resolveMessageRouting(type, 0.79, THRESHOLDS)).toEqual({ isInboxVisible: true, needsManualReview: true })
    })
  })

  describe('at exactly the review threshold (0.80) — no longer needs review', () => {
    it.each(ALL_TYPES)('%s at confidence 0.80', (type) => {
      const result = resolveMessageRouting(type, 0.8, THRESHOLDS)
      expect(result.needsManualReview).toBe(false)
    })

    it('hide-eligible types stay visible at 0.80 (below hideThreshold)', () => {
      for (const type of HIDE_ELIGIBLE) {
        expect(resolveMessageRouting(type, 0.8, THRESHOLDS)).toEqual({ isInboxVisible: true, needsManualReview: false })
      }
    })
  })

  describe('the [reviewThreshold, hideThreshold) zone — intentionally visible, not auto-hidden', () => {
    it.each(ALL_TYPES)('%s at confidence 0.89 stays visible', (type) => {
      const result = resolveMessageRouting(type, 0.89, THRESHOLDS)
      expect(result.isInboxVisible).toBe(true)
      expect(result.needsManualReview).toBe(false)
    })
  })

  describe('at exactly the hide threshold (0.90)', () => {
    it.each(HIDE_ELIGIBLE)('%s is hidden at confidence 0.90', (type) => {
      expect(resolveMessageRouting(type, 0.9, THRESHOLDS)).toEqual({ isInboxVisible: false, needsManualReview: false })
    })

    it.each(['CUSTOMER_REVIEW', 'CUSTOMER_COMPLAINT', 'CUSTOMER_QUESTION', 'CHAT_DISCUSSION', 'NEWS_MENTION'] as MessageClassificationType[])(
      '%s stays visible at confidence 0.90 (not hide-eligible)',
      (type) => {
        expect(resolveMessageRouting(type, 0.9, THRESHOLDS)).toEqual({ isInboxVisible: true, needsManualReview: false })
      }
    )
  })

  describe('above the hide threshold (0.91)', () => {
    it.each(HIDE_ELIGIBLE)('%s is hidden at confidence 0.91', (type) => {
      expect(resolveMessageRouting(type, 0.91, THRESHOLDS)).toEqual({ isInboxVisible: false, needsManualReview: false })
    })

    it.each(['CUSTOMER_REVIEW', 'CUSTOMER_COMPLAINT', 'CUSTOMER_QUESTION', 'CHAT_DISCUSSION', 'NEWS_MENTION'] as MessageClassificationType[])(
      '%s stays visible at confidence 0.91',
      (type) => {
        const result = resolveMessageRouting(type, 0.91, THRESHOLDS)
        expect(result.isInboxVisible).toBe(true)
      }
    )
  })

  it('a technical classifier failure (type:null, confidence:0) always yields visible + needs review', () => {
    expect(resolveMessageRouting(null, 0, THRESHOLDS)).toEqual({ isInboxVisible: true, needsManualReview: true })
  })

  it('confidence of exactly 1.0 with a hide-eligible type is hidden', () => {
    expect(resolveMessageRouting('SPAM', 1, THRESHOLDS)).toEqual({ isInboxVisible: false, needsManualReview: false })
  })

  describe('decision=UNSURE never auto-hides, regardless of type/confidence', () => {
    it.each(HIDE_ELIGIBLE)('%s at confidence 1.0 with decision=UNSURE stays visible', (type) => {
      expect(resolveMessageRouting(type, 1, THRESHOLDS, 'UNSURE')).toEqual({ isInboxVisible: true, needsManualReview: false })
    })

    it('UNSURE below the review threshold still needs review (review threshold takes precedence)', () => {
      expect(resolveMessageRouting('SPAM', 0.5, THRESHOLDS, 'UNSURE')).toEqual({ isInboxVisible: true, needsManualReview: true })
    })
  })
})
