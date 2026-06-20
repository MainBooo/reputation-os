import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import { createHash } from 'crypto'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { PageWatchExtractor } from './page-watch-extractor'
import { normalizeText } from '../common/utils/normalize.util'
import { classifySentiment } from '../common/utils/sentiment.util'

@Injectable()
export class PageWatchProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker
  private readonly extractor = new PageWatchExtractor()

  constructor(
    @Inject('BULLMQ_WORKER_CONNECTION_FACTORY') private readonly workerConnectionFactory: () => any,
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

  private extractText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex')
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

    console.log(`[PageWatch] checking ${page.url}`)

    try {
      const response = await fetch(page.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ReputationOS/1.0; +https://reputationos.ru)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ru,en;q=0.9'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        await this.prisma.watchedPage.update({
          where: { id: watchedPageId },
          data: { lastCheckedAt: new Date(), lastError: `HTTP ${response.status}` }
        })
        console.warn(`[PageWatch] HTTP ${response.status} for ${page.url}`)
        return
      }

      const html = await response.text()
      const text = this.extractText(html)
      const newHash = this.hashText(text)
      const changed = newHash !== page.contentHash

      // Определяем тип страницы если ещё не определён
      let pageType = page.pageType
      if (pageType === 'UNKNOWN' || !pageType) {
        pageType = await this.extractor.detectPageTypeWithLlm(html, page.url)
        console.log(`[PageWatch] detected pageType=${pageType} for ${page.url}`)
      }

      await this.prisma.watchedPage.update({
        where: { id: watchedPageId },
        data: {
          lastCheckedAt: new Date(),
          lastError: null,
          contentHash: newHash,
          pageType,
          ...(changed ? { lastChangedAt: new Date() } : {})
        }
      })

      // Извлекаем элементы и создаём Mention при изменениях
      if (page.sourceTarget?.source) {
        const source = page.sourceTarget.source
        const items = this.extractor.extractItems(html, pageType as any, page.url)
        console.log(`[PageWatch] extracted ${items.length} items from ${page.url}`)

        for (const item of items) {
          // Проверяем дубликат по itemHash
          const existing = await (this.prisma as any).watchedPageItem.findUnique({
            where: { watchedPageId_itemHash: { watchedPageId, itemHash: item.itemHash } }
          }).catch(() => null)

          if (existing) continue

          // Создаём WatchedPageItem
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

          // Создаём Mention
          const content = item.content || item.title || ''
          if (!content || content.length < 10) continue

          const normalizedContent = normalizeText(content)
          const mentionHash = this.hashText(
            `pagewatch|${page.companyId}|${source.id}|${item.itemHash}`
          )

          const existingMention = await this.prisma.mention.findFirst({
            where: { companyId: page.companyId, hash: mentionHash }
          }).catch(() => null)

          if (existingMention) continue

          const sentiment = item.ratingValue != null
            ? (item.ratingValue <= 2 ? 'NEGATIVE' : item.ratingValue >= 4 ? 'POSITIVE' : 'NEUTRAL')
            : classifySentiment(normalizedContent)

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
              publishedAt: item.publishedAt || new Date(),
              ratingValue: item.ratingValue ?? null,
              sentiment,
              status: 'NEW',
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
      const message = err?.message || String(err)
      await this.prisma.watchedPage.update({
        where: { id: watchedPageId },
        data: { lastCheckedAt: new Date(), lastError: message.slice(0, 500) }
      }).catch(() => null)
      console.error(`[PageWatch] error ${page.url}`, message)
    }
  }
}
