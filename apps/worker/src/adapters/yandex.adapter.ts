import { Injectable } from '@nestjs/common'
import { MockAdapter } from './mock.adapter'

@Injectable()
export class YandexAdapter {
  private readonly mock: MockAdapter

  constructor() {
    this.mock = new MockAdapter()
  }

  async discoverTargets(_input?: any) {
    return this.mock.discoverTargets()
  }

  async fetchMentions(_target?: any) {
    return this.mock.fetchMentions()
  }

  async fetchRatingSnapshot(_target?: any) {
    return this.mock.fetchRatingSnapshot()
  }
}
