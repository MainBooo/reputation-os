import { SourceAdapter } from './source-adapter.interface'

export class MockAdapter implements SourceAdapter {
  async discoverTargets() {
    return [
      { externalPlaceId: 'demo-place-1', displayName: 'Demo Listing 1' }
    ]
  }

  async fetchMentions() {
    return [
      {
        externalMentionId: 'mock:mention:1',
        url: 'https://example.com/review/1',
        title: 'Демо отзыв',
        content: 'Отличный сервис и быстрая поддержка',
        author: 'Demo User',
        publishedAt: new Date(),
        ratingValue: 5
      }
    ]
  }

  async fetchRatingSnapshot() {
    return {
      ratingValue: 4.7,
      reviewsCount: 124,
      capturedAt: new Date()
    }
  }
}
