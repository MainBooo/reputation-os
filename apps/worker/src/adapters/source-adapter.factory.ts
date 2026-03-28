import { Platform } from '@prisma/client'
import { GoogleAdapter } from './google.adapter'
import { MockAdapter } from './mock.adapter'
import { SourceAdapter } from './source-adapter.interface'
import { WebMentionAdapter } from './webmention.adapter'
import { TwoGisAdapter } from './twogis.adapter'
import { YandexAdapter } from './yandex.adapter'

export class SourceAdapterFactory {
  static getAdapter(platform: Platform): SourceAdapter {
    switch (platform) {
      case 'YANDEX':
        return new YandexAdapter()
      case 'GOOGLE':
        return new GoogleAdapter()
      case 'TWOGIS':
        return new TwoGisAdapter()
      case 'WEB':
        return new WebMentionAdapter()
      case 'CUSTOM':
        return new MockAdapter()
      default:
        return new MockAdapter()
    }
  }
}
