import { SourceAdapter } from './source-adapter.interface'

export class EmptyAdapter implements SourceAdapter {
  async discoverTargets() {
    return []
  }

  async fetchMentions() {
    return []
  }

  async fetchRatingSnapshot() {
    return null
  }
}
