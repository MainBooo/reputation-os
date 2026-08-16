import { Platform } from '@prisma/client'
import { EmptyAdapter } from './empty.adapter'
import { SourceAdapter } from './source-adapter.interface'
import { WebMentionAdapter } from './webmention.adapter'
import { TwoGisAdapter } from './twogis.adapter'
import { YandexAdapter } from './yandex.adapter'

export class UnsupportedSourcePlatformError extends Error {
  constructor(platform: string) {
    super(`Source platform is not implemented: ${platform}`)
    this.name = 'UnsupportedSourcePlatformError'
  }
}

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
      case 'GOOGLE':
      case 'TELEGRAM':
        throw new UnsupportedSourcePlatformError(platform)
      default:
        throw new UnsupportedSourcePlatformError(String(platform))
    }
  }
}
