import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import { createHash } from 'crypto'
import * as cheerio from 'cheerio'
import axios from 'axios'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { PageWatchExtractor, ExtractedItem } from './page-watch-extractor'
import { normalizeText } from '../common/utils/normalize.util'
import { classifySentiment } from '../common/utils/sentiment.util'

const DOMAIN_LOCK_PREFIX = 'pw:domain:'
const DOMAIN_LOCK_TTL_SEC = 10
const MAX_CONSECUTIVE_ERRORS = 5
const PAGE_TYPE_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Selectors tried in priority order for semantic content extraction
const SEMANTIC_SELECTORS = ['main', 'article', '[role="main"]', '#content', '#main', '.content', '.main']

@Injectable()
export class PageWatchProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker
  private readonly extractor = new PageWatchExtractor()

  constructor(
    @Inject('BULLMQ_WORKER_CONNECTION_FACTORY') private readonly workerConnectionFactory: () => any,
    @Inject('BULLMQ_CONNECTION') private readonly redis: any,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    const connection = this.workerConnectionFactory()
    this.worker = new Worker(QUEUES.PAGE_WATCH, async (job: Job) => this.handle(job), {
      connection,
      concurrency: 2,
      lockDuration: 2 * 60_000
    })
    this.worker.on('ready', () => console.log('[PageWatch] Worker READY'))
    this.worker.on('error', (err) => console.error('[PageWatch] Worker error', err))
    this.worker.on('failed', (job, err) => console.error(`[PageWatch] failed jobId=${job?.id}`, err))
    await this.worker.waitUntilReady()
    console.log('[PageWatch] Worker waitUntilReady OK')
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  // ── Semantic text extraction (Cheerio) ────────────────────────────────────
  // Targets semantic content blocks to avoid hashing noise (sidebars, menus, ads).
  private extractText(html: string): string {
    const $ = cheerio.load(html)
    $('script, style, nav, footer, header, noscript, aside, [role="banner"], [role="navigation"]').remove()

    for (const sel of SEMANTIC_SELECTORS) {
      const text = $(sel).text().replace(/\s+/g, ' ').trim()
      if (text.length > 100) return text
    }

    return $('body').text().replace(/\s+/g, ' ').trim()
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex')
  }

  private nextCheckAt(checkIntervalMin: number): Date {
    return new Date(Date.now() + checkIntervalMin * 60 * 1000)
  }

  private async incrementError(watchedPageId: string, errorMsg: string, currentErrors: number) {
    const consecutiveErrors = currentErrors + 1
    const shouldDisable = consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
    const disabledReason = shouldDisable
      ? `Auto-disabled after ${consecutiveErrors} consecutive errors. Last: ${errorMsg.slice(0, 200)}`
      : null

    await this.prisma.watchedPage.update({
      where: { id: watchedPageId },
      data: {
        lastCheckedAt: new Date(),
        lastError: errorMsg.slice(0, 500),
        consecutiveErrors,
        ...(shouldDisable ? { enabled: false, disabledReason } : {})
      }
    })

    if (shouldDisable) {
      console.warn(`[PageWatch] auto-disabled pageId=${watchedPageId} after ${consecutiveErrors} errors`)
    }
  }

  private async resetErrors(watchedPageId: string, updates: Record<string, any>) {
    await this.prisma.watchedPage.update({
      where: { id: watchedPageId },
      data: { ...updates, consecutiveErrors: 0, lastError: null }
    })
  }

  // ── Batch LLM sentiment for ambiguous (NEUTRAL keyword-classified) items ──
  // Returns sentiment per item. Falls back to NEUTRAL if LLM unavailable.
  private async batchLlmSentiment(
    texts: string[]
  ): Promise<Array<'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'>> {
    const apiKey = process.env.YANDEX_GPT_API_KEY
    const folderId = process.env.YANDEX_GPT_FOLDER_ID
    if (!apiKey || !folderId || texts.length === 0) return texts.map(() => 'NEUTRAL')

    // Build a numbered list for the model to classify in one shot
    const numbered = texts.map((t, i) => `${i + 1}. ${t.slice(0, 300)}`).join('\n')
    try {
      const { data } = await axios.post(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
        {
          modelUri: `gpt://${folderId}/yandexgpt-lite`,
          completionOptions: { stream: false, temperature: 0, maxTokens: texts.length * 5 },
          messages: [
            {
              role: 'system',
              text: `Определи тональность каждого текста. Ответь строго в формате:\n1. POSITIVE|NEGATIVE|NEUTRAL\n2. ...\nТолько эти три слова. Никакого другого текста.`
            },
            { role: 'user', text: numbered }
          ]
        },
        {
          headers: { Authorization: `Api-Key ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 10000
        }
      )
      const answer: string = data?.result?.alternatives?.[0]?.message?.text?.trim() || ''
      const lines = answer.split('\n')
      return texts.map((_, i) => {
        const line = (lines[i] || '').replace(/^\d+\.\s*/, '').trim().toUpperCase()
        if (line === 'POSITIVE' || line === 'NEGATIVE' || line === 'NEUTRAL') return line
        return 'NEUTRAL'
      })
    } catch {
      return texts.map(() => 'NEUTRAL')
    }
  }

  async handle(job: Job<{ watchedPageId: string }>) {
    const { watchedPageId } = job.data
    const page = await this.prisma.watchedPage.findUnique({
      where: { id: watchedPageId },
      include: { sourceTarget: { include: { source: true } } }
    })

    if (!page || !page.enabled) {
      console.log(`[PageWatch] skip disabled/missing page ${watchedPageId}`)
      return
    }

    // ── Domain rate limiting ────────────────────────────────────────────────
    const domainLockKey = `${DOMAIN_LOCK_PREFIX}${page.domain}`
    const acquired = await this.redis.set(domainLockKey, '1', 'NX', 'EX', DOMAIN_LOCK_TTL_SEC)
    if (!acquired) {
      const retryAt = new Date(Date.now() + 60_000)
      await this.prisma.watchedPage.update({
        where: { id: watchedPageId },
        data: { nextCheckAt: retryAt }
      }).catch(() => null)
      console.log(`[PageWatch] domain throttled, deferred 60s: ${page.url}`)
      return
    }

    console.log(`[PageWatch] checking ${page.url}`)

    const pageData = page as any

    try {
      // ── Build request headers (conditional HTTP) ──────────────────────────
      const reqHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (compatible; ReputationOS/1.0; +https://reputationos.ru)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru,en;q=0.9'
      }
      if (pageData.etag) reqHeaders['If-None-Match'] = pageData.etag
      if (pageData.lastModifiedHeader) reqHeaders['If-Modified-Since'] = pageData.lastModifiedHeader

      const response = await fetch(page.url, {
        headers: reqHeaders,
        signal: AbortSignal.timeout(15000)
      })

      // ── HTTP 304 Not Modified ─────────────────────────────────────────────
      if (response.status === 304) {
        await this.resetErrors(watchedPageId, {
          lastCheckedAt: new Date(),
          nextCheckAt: this.nextCheckAt(page.checkIntervalMin)
        })
        console.log(`[PageWatch] 304 Not Modified (no change): ${page.url}`)
        return
      }

      // ── HTTP errors ───────────────────────────────────────────────────────
      if (!response.ok) {
        await this.incrementError(watchedPageId, `HTTP ${response.status}`, pageData.consecutiveErrors ?? 0)
        await this.prisma.watchedPage.update({
          where: { id: watchedPageId },
          data: { nextCheckAt: this.nextCheckAt(page.checkIntervalMin) }
        }).catch(() => null)
        console.warn(`[PageWatch] HTTP ${response.status} for ${page.url}`)
        return
      }

      const newEtag = response.headers.get('etag') ?? null
      const newLastModified = response.headers.get('last-modified') ?? null

      const html = await response.text()

      // ── CAPTCHA / block detection ─────────────────────────────────────────
      const isCaptcha = /yandex smartcaptcha|smartcaptcha\.yandex\.net|captcha-container|you are being blocked|вы не робот|подтвердите, что запросы отправляли вы|вы робот|capt4a=|captcha-form/i.test(html)
      if (isCaptcha) {
        await this.incrementError(watchedPageId, 'CAPTCHA_DETECTED', pageData.consecutiveErrors ?? 0)
        await this.prisma.watchedPage.update({
          where: { id: watchedPageId },
          data: { nextCheckAt: this.nextCheckAt(page.checkIntervalMin) }
        }).catch(() => null)
        console.warn('[PageWatch] CAPTCHA detected for ' + page.url)
        return
      }

      // ── Content hash (semantic content only, ignores noisy blocks) ────────
      const text = this.extractText(html)
      const newHash = this.hashText(text)
      const changed = newHash !== page.contentHash

      // ── Detect page type if unknown or stale (site structure may have changed) ─
      let pageType = page.pageType
      const pageTypeStale =
        !page.pageTypeCheckedAt || Date.now() - page.pageTypeCheckedAt.getTime() > PAGE_TYPE_TTL_MS
      let pageTypeCheckedAt = page.pageTypeCheckedAt
      if (pageType === 'UNKNOWN' || !pageType || pageTypeStale) {
        pageType = await this.extractor.detectPageTypeWithLlm(html, page.url)
        pageTypeCheckedAt = new Date()
        console.log(`[PageWatch] detected pageType=${pageType} for ${page.url}`)
      }

      // ── Persist page state ────────────────────────────────────────────────
      await this.resetErrors(watchedPageId, {
        lastCheckedAt: new Date(),
        nextCheckAt: this.nextCheckAt(page.checkIntervalMin),
        contentHash: newHash,
        pageType,
        pageTypeCheckedAt,
        etag: newEtag,
        lastModifiedHeader: newLastModified,
        ...(changed ? { lastChangedAt: new Date() } : {})
      })

      // ── Extract items and create Mentions ─────────────────────────────────
      if (page.sourceTarget?.source) {
        const source = page.sourceTarget.source
        const items = this.extractor.extractItems(html, pageType as any, page.url)
        console.log(`[PageWatch] extracted ${items.length} items from ${page.url}`)

        // Step 1: keyword-based sentiment pass
        type ItemWithMeta = {
          item: ExtractedItem
          normalizedContent: string
          mentionHash: string
          sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNKNOWN'
          needsLlm: boolean
        }

        const candidates: ItemWithMeta[] = []

        for (const item of items) {
          const existing = await (this.prisma as any).watchedPageItem.findUnique({
            where: { watchedPageId_itemHash: { watchedPageId, itemHash: item.itemHash } }
          }).catch(() => null)
          if (existing) continue

          const content = item.content || item.title || ''
          const normalizedContent = normalizeText(content)
          const mentionHash = this.hashText(`pagewatch|${page.companyId}|${source.id}|${item.itemHash}`)

          let sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNKNOWN'
          let needsLlm = false

          if (item.ratingValue != null) {
            sentiment = item.ratingValue <= 2 ? 'NEGATIVE' : item.ratingValue >= 4 ? 'POSITIVE' : 'NEUTRAL'
          } else {
            const kw = classifySentiment(normalizedContent)
            if (kw === 'NEUTRAL') {
              // Keyword rules found nothing clear — mark for LLM batch
              sentiment = 'NEUTRAL'
              needsLlm = content.length >= 50
            } else {
              sentiment = kw
            }
          }

          candidates.push({ item, normalizedContent, mentionHash, sentiment, needsLlm })
        }

        // Step 2: batch LLM for ambiguous items (only when content is long enough to be meaningful)
        const llmItems = candidates.filter(c => c.needsLlm)
        if (llmItems.length > 0) {
          console.log(`[PageWatch] batch LLM sentiment for ${llmItems.length} ambiguous items`)
          const llmResults = await this.batchLlmSentiment(llmItems.map(c => c.normalizedContent))
          llmItems.forEach((c, i) => { c.sentiment = llmResults[i] })
        }

        // Step 3: persist WatchedPageItem + Mention
        for (const { item, normalizedContent, mentionHash, sentiment } of candidates) {
          await (this.prisma as any).watchedPageItem.create({
            data: {
              watchedPageId,
              companyId: page.companyId,
              itemHash: item.itemHash,
              itemType: item.itemType,
              title: item.title || null,
              content: item.content || null,
              author: item.author || null,
              ratingValue: item.ratingValue || null,
              publishedAt: item.publishedAt || null,
              url: item.url || page.url
            }
          }).catch((e: any) => {
            if (!e?.message?.includes('Unique constraint')) {
              console.error('[PageWatch] WatchedPageItem create error', e?.message)
            }
          })

          const content = item.content || item.title || ''
          if (!content || content.length < 50) continue

          const existingMention = await this.prisma.mention.findFirst({
            where: { companyId: page.companyId, hash: mentionHash }
          }).catch(() => null)
          if (existingMention) continue

          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
          const isOld = !item.publishedAt || (Date.now() - item.publishedAt.getTime()) > SEVEN_DAYS_MS
          const mentionStatus = isOld ? 'ARCHIVED' : 'NEW'

          console.log(`[PageWatch] item publishedAt=${item.publishedAt?.toISOString() ?? 'null'} status=${mentionStatus} url=${page.url}`)

          await this.prisma.mention.create({
            data: {
              companyId: page.companyId,
              sourceId: source.id,
              platform: 'WEB',
              type: item.itemType === 'review' ? 'REVIEW' : item.itemType === 'article' ? 'ARTICLE' : 'WEB_MENTION',
              externalMentionId: `pagewatch:${item.itemHash}`,
              url: item.url || page.url,
              title: item.title || null,
              content,
              normalizedContent,
              author: item.author || null,
              publishedAt: item.publishedAt ?? new Date(),
              ratingValue: item.ratingValue ?? null,
              sentiment,
              status: mentionStatus,
              hash: mentionHash,
              companySourceTargetId: page.sourceTargetId || null
            }
          }).catch((e: any) => {
            if (!e?.message?.includes('Unique constraint')) {
              console.error('[PageWatch] Mention create error', e?.message)
            }
          })

          console.log(`[PageWatch] new ${item.itemType} saved for ${page.url}`)
        }
      }

      console.log(`[PageWatch] done ${page.url} changed=${changed}`)
    } catch (err: any) {
      const message = (err?.message || String(err)).slice(0, 500)
      await this.incrementError(watchedPageId, message, pageData.consecutiveErrors ?? 0)
      await this.prisma.watchedPage.update({
        where: { id: watchedPageId },
        data: { nextCheckAt: this.nextCheckAt(page.checkIntervalMin) }
      }).catch(() => null)
      console.error(`[PageWatch] error ${page.url}`, message)
    }
    // Domain lock expires automatically after DOMAIN_LOCK_TTL_SEC seconds
  }
}
