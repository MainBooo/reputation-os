import { Platform } from '@prisma/client'
import { EmptyAdapter } from './empty.adapter'
import { SourceAdapter } from './source-adapter.interface'
import { WebMentionAdapter } from './webmention.adapter'
import { TwoGisAdapter } from './twogis.adapter'
import { YandexAdapter } from './yandex.adapter'

export class SourceAdapterFactory {
  static getAdapter(platform: Platform): SourceAdapter {
    switch (platform) {
      case 'YANDEX':
        return new YandexAdapter()
      case 'TWOGIS':
        return new TwoGisAdapter()
      case 'WEB':
        return new WebMentionAdapter()
      case 'CUSTOM':
        return new EmptyAdapter()
      default:
        return new EmptyAdapter()
    }
  }
}
