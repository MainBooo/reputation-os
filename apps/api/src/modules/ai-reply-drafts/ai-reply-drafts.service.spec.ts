import { Test } from '@nestjs/testing'
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common'
import { AiReplyDraftsService } from './ai-reply-drafts.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from '../billing/entitlements.service'

const mockPrisma = {
  mention: { findUnique: jest.fn() },
  workspaceMember: { findFirst: jest.fn() },
  aIReplyDraft: { count: jest.fn(), create: jest.fn() }
}

const mockEntitlements = {
  getForWorkspace: jest.fn()
}

const baseMention = {
  id: 'mention-1',
  companyId: 'co-1',
  ratingValue: 2,
  author: 'Иван',
  content: 'Долго ждали заказ.',
  platform: 'YANDEX',
  company: { id: 'co-1', workspaceId: 'ws-1', name: 'Acme', responsePreset: null },
  source: { platform: 'YANDEX' }
}

function yandexGptResponse(text: string) {
  return { output: [{ content: [{ text }] }] }
}

describe('AiReplyDraftsService — generate', () => {
  let service: AiReplyDraftsService
  let fetchMock: jest.Mock
  const ORIGINAL_ENV = process.env

  beforeEach(async () => {
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }

    fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock

    mockPrisma.mention.findUnique.mockResolvedValue(baseMention)
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ id: 'wm-1', userId: 'u-1', workspaceId: 'ws-1' })
    mockPrisma.aIReplyDraft.count.mockResolvedValue(0)
    mockEntitlements.getForWorkspace.mockResolvedValue({ limits: { maxAiRepliesPerMonth: -1 } })

    const module = await Test.createTestingModule({
      providers: [
        AiReplyDraftsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EntitlementsService, useValue: mockEntitlements }
      ]
    }).compile()
    service = module.get(AiReplyDraftsService)
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('generates a reply draft via the (mocked) provider and stores it', async () => {
    process.env.YANDEX_GPT_API_KEY = 'test-key'
    process.env.YANDEX_GPT_FOLDER_ID = 'test-folder'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => yandexGptResponse('Спасибо за отзыв, разберёмся с задержкой.')
    })
    mockPrisma.aIReplyDraft.create.mockResolvedValue({ id: 'draft-1', draftText: 'Спасибо за отзыв, разберёмся с задержкой.' })

    const result = await service.generate('u-1', 'mention-1', {})

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockPrisma.aIReplyDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ draftText: 'Спасибо за отзыв, разберёмся с задержкой.' })
      })
    )
    expect(result).toMatchObject({ id: 'draft-1' })
  })

  it('throws ServiceUnavailableException without calling the provider when AI is not configured', async () => {
    delete process.env.YANDEX_GPT_API_KEY
    delete process.env.YANDEX_GPT_FOLDER_ID

    await expect(service.generate('u-1', 'mention-1', {})).rejects.toThrow(ServiceUnavailableException)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockPrisma.aIReplyDraft.create).not.toHaveBeenCalled()
  })

  it('throws ServiceUnavailableException (not a raw error) when the provider request times out', async () => {
    process.env.YANDEX_GPT_API_KEY = 'test-key'
    process.env.YANDEX_GPT_FOLDER_ID = 'test-folder'
    const timeoutError = new Error('The operation was aborted due to timeout')
    timeoutError.name = 'TimeoutError'
    fetchMock.mockRejectedValue(timeoutError)

    await expect(service.generate('u-1', 'mention-1', {})).rejects.toThrow(ServiceUnavailableException)
    expect(mockPrisma.aIReplyDraft.create).not.toHaveBeenCalled()
  })

  it('throws ServiceUnavailableException when the provider returns a malformed (non-JSON) response', async () => {
    process.env.YANDEX_GPT_API_KEY = 'test-key'
    process.env.YANDEX_GPT_FOLDER_ID = 'test-folder'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token in JSON')
      }
    })

    await expect(service.generate('u-1', 'mention-1', {})).rejects.toThrow(ServiceUnavailableException)
    expect(mockPrisma.aIReplyDraft.create).not.toHaveBeenCalled()
  })

  it('throws ServiceUnavailableException when the provider returns an empty reply', async () => {
    process.env.YANDEX_GPT_API_KEY = 'test-key'
    process.env.YANDEX_GPT_FOLDER_ID = 'test-folder'
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => yandexGptResponse('') })

    await expect(service.generate('u-1', 'mention-1', {})).rejects.toThrow(ServiceUnavailableException)
  })

  it('throws ServiceUnavailableException on a non-2xx provider response without leaking the raw error body', async () => {
    process.env.YANDEX_GPT_API_KEY = 'test-key'
    process.env.YANDEX_GPT_FOLDER_ID = 'test-folder'
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'internal provider stack trace...' })

    let caught: any
    try {
      await service.generate('u-1', 'mention-1', {})
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(ServiceUnavailableException)
    expect(caught.message).not.toContain('internal provider stack trace')
  })

  it('enforces the monthly plan limit before calling the provider', async () => {
    mockEntitlements.getForWorkspace.mockResolvedValue({ limits: { maxAiRepliesPerMonth: 5 } })
    mockPrisma.aIReplyDraft.count.mockResolvedValue(5)

    await expect(service.generate('u-1', 'mention-1', {})).rejects.toThrow(ForbiddenException)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
