import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import { createHash } from 'crypto'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { WORKER_OPTIONS } from '../queues/job-options'

@Injectable()
export class PageWatchProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

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
    // Убираем script, style, nav, footer, header, noscript
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      // Убираем все HTML теги
      .replace(/<[^>]+>/g, ' ')
      // Нормализуем пробелы
      .replace(/\s+/g, ' ')
      .trim()

    return text
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex')
  }

  async handle(job: Job<{ watchedPageId: string }>) {
    const { watchedPageId } = job.data
    const page = await this.prisma.watchedPage.findUnique({ where: { id: watchedPageId } })

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
          data: {
            lastCheckedAt: new Date(),
            lastError: `HTTP ${response.status}`
          }
        })
        console.warn(`[PageWatch] HTTP ${response.status} for ${page.url}`)
        return
      }

      const html = await response.text()
      const text = this.extractText(html)
      const newHash = this.hashText(text)
      const changed = newHash !== page.contentHash

      await this.prisma.watchedPage.update({
        where: { id: watchedPageId },
        data: {
          lastCheckedAt: new Date(),
          lastError: null,
          contentHash: newHash,
          ...(changed ? { lastChangedAt: new Date() } : {})
        }
      })

      console.log(`[PageWatch] done ${page.url} changed=${changed}`)
    } catch (err: any) {
      const message = err?.message || String(err)
      await this.prisma.watchedPage.update({
        where: { id: watchedPageId },
        data: {
          lastCheckedAt: new Date(),
          lastError: message.slice(0, 500)
        }
      }).catch(() => null)
      console.error(`[PageWatch] error ${page.url}`, message)
    }
  }
}
