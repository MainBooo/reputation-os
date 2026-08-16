import { Platform } from '@prisma/client'
import { EmptyAdapter } from './empty.adapter'
import { SourceAdapterFactory, UnsupportedSourcePlatformError } from './source-adapter.factory'

describe('SourceAdapterFactory', () => {
  it('rejects GOOGLE explicitly instead of silently returning an empty adapter', () => {
    expect(() => SourceAdapterFactory.getAdapter(Platform.GOOGLE)).toThrow(UnsupportedSourcePlatformError)
  })

  it('keeps CUSTOM as the intentional no-op integration', () => {
    expect(SourceAdapterFactory.getAdapter(Platform.CUSTOM)).toBeInstanceOf(EmptyAdapter)
  })
})
