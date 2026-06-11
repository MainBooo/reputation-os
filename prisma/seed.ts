import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('demo123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'demo@reputation.local' },
    update: {},
    create: {
      email: 'demo@reputation.local',
      passwordHash,
      fullName: 'Demo User',
      isActive: true
    }
  })

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace'
    }
  })

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id
      }
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'OWNER'
    }
  })

  const companyOne = await prisma.company.create({
    data: {
      workspaceId: workspace.id,
      name: 'Acme Corp',
      normalizedName: 'acme corp',
      website: 'https://acme.example.com',
      normalizedWebsite: 'acme.example.com',
      city: 'Moscow',
      normalizedCity: 'moscow',
      industry: 'Tech',
      description: 'B2B service company',
      isActive: true
    }
  }).catch(async () => {
    return prisma.company.findFirstOrThrow({ where: { workspaceId: workspace.id, name: 'Acme Corp' } })
  })

  const companyTwo = await prisma.company.create({
    data: {
      workspaceId: workspace.id,
      name: 'Northwind Market',
      normalizedName: 'northwind market',
      website: 'https://northwind.example.com',
      normalizedWebsite: 'northwind.example.com',
      city: 'Saint Petersburg',
      normalizedCity: 'saint petersburg',
      industry: 'Retail',
      description: 'Retail and marketplace brand',
      isActive: true
    }
  }).catch(async () => {
    return prisma.company.findFirstOrThrow({ where: { workspaceId: workspace.id, name: 'Northwind Market' } })
  })

  await prisma.companyAlias.createMany({
    data: [
      { companyId: companyOne.id, value: 'Acme', normalizedValue: 'acme', priority: 10, isPrimary: true },
      { companyId: companyOne.id, value: 'Acme Corp', normalizedValue: 'acme corp', priority: 20, isPrimary: false },
      { companyId: companyTwo.id, value: 'Northwind', normalizedValue: 'northwind', priority: 10, isPrimary: true }
    ],
    skipDuplicates: true
  })

  const yandexSource = await prisma.source.create({
    data: {
      workspaceId: workspace.id,
      name: 'Yandex Reviews',
      platform: 'YANDEX',
      type: 'REVIEW_FEED',
      isEnabled: true
    }
  }).catch(async () => prisma.source.findFirstOrThrow({ where: { workspaceId: workspace.id, name: 'Yandex Reviews' } }))

  const googleSource = await prisma.source.create({
    data: {
      workspaceId: workspace.id,
      name: 'Google Reviews',
      platform: 'GOOGLE',
      type: 'REVIEW_FEED',
      isEnabled: true
    }
  }).catch(async () => prisma.source.findFirstOrThrow({ where: { workspaceId: workspace.id, name: 'Google Reviews' } }))

  const webSource = await prisma.source.create({
    data: {
      workspaceId: workspace.id,
      name: 'Web Monitor',
      platform: 'WEB',
      type: 'WEB_MENTION_FEED',
      isEnabled: true
    }
  }).catch(async () => prisma.source.findFirstOrThrow({ where: { workspaceId: workspace.id, name: 'Web Monitor' } }))

  const acmeYandexTarget = await prisma.companySourceTarget.create({
    data: {
      companyId: companyOne.id,
      sourceId: yandexSource.id,
      externalPlaceId: 'acme-yandex-place',
      externalUrl: 'https://yandex.ru/maps/org/acme/123',
      displayName: 'Acme on Yandex',
      isActive: true
    }
  }).catch(async () => prisma.companySourceTarget.findFirstOrThrow({ where: { companyId: companyOne.id, sourceId: yandexSource.id } }))

  const acmeGoogleTarget = await prisma.companySourceTarget.create({
    data: {
      companyId: companyOne.id,
      sourceId: googleSource.id,
      externalPlaceId: 'acme-google-place',
      externalUrl: 'https://maps.google.com/?cid=acme',
      displayName: 'Acme on Google',
      isActive: true
    }
  }).catch(async () => prisma.companySourceTarget.findFirstOrThrow({ where: { companyId: companyOne.id, sourceId: googleSource.id } }))

  const acmeWebTarget = await prisma.companySourceTarget.create({
    data: {
      companyId: companyOne.id,
      sourceId: webSource.id,
      externalUrl: 'https://acme.example.com',
      displayName: 'Acme Web Monitor',
      isActive: true
    }
  }).catch(async () => prisma.companySourceTarget.findFirstOrThrow({ where: { companyId: companyOne.id, sourceId: webSource.id } }))

  const northwindWebTarget = await prisma.companySourceTarget.create({
    data: {
      companyId: companyTwo.id,
      sourceId: webSource.id,
      externalUrl: 'https://northwind.example.com',
      displayName: 'Northwind Web Monitor',
      isActive: true
    }
  }).catch(async () => prisma.companySourceTarget.findFirstOrThrow({ where: { companyId: companyTwo.id, sourceId: webSource.id } }))

  const mentionOne = await prisma.mention.create({
    data: {
      companyId: companyOne.id,
      platform: 'YANDEX',
      type: 'REVIEW',
      sourceId: yandexSource.id,
      companySourceTargetId: acmeYandexTarget.id,
      externalMentionId: 'yandex:review:1',
      url: 'https://yandex.ru/maps/org/acme/reviews/1',
      title: 'Понравился сервис',
      content: 'Отличный сервис, быстро решили вопрос и помогли с настройкой.',
      normalizedContent: 'отличный сервис быстро решили вопрос и помогли с настройкой',
      author: 'Ирина',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      ratingValue: 5,
      sentiment: 'POSITIVE',
      status: 'NEW',
      hash: 'seed-hash-1'
    }
  }).catch(async () => prisma.mention.findFirstOrThrow({ where: { externalMentionId: 'yandex:review:1' } }))

  await prisma.mention.create({
    data: {
      companyId: companyOne.id,
      platform: 'GOOGLE',
      type: 'REVIEW',
      sourceId: googleSource.id,
      companySourceTargetId: acmeGoogleTarget.id,
      externalMentionId: 'google:review:1',
      url: 'https://maps.google.com/review/acme-1',
      title: 'Есть нюансы',
      content: 'В целом неплохо, но сроки чуть затянулись.',
      normalizedContent: 'в целом неплохо но сроки чуть затянулись',
      author: 'Alex',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
      ratingValue: 3,
      sentiment: 'NEUTRAL',
      status: 'NEW',
      hash: 'seed-hash-2'
    }
  }).catch(() => null)

  await prisma.mention.create({
    data: {
      companyId: companyOne.id,
      platform: 'WEB',
      type: 'WEB_MENTION',
      sourceId: webSource.id,
      companySourceTargetId: acmeWebTarget.id,
      externalMentionId: 'web:article:1',
      url: 'https://news.example.com/acme-growth',
      title: 'Acme в обзоре B2B рынка',
      content: 'Компания Acme получила сильные отзывы от клиентов и улучшила показатели поддержки.',
      normalizedContent: 'компания acme получила сильные отзывы от клиентов и улучшила показатели поддержки',
      author: 'Industry Media',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      sentiment: 'POSITIVE',
      status: 'REVIEWED',
      hash: 'seed-hash-3'
    }
  }).catch(() => null)

  const negativeMention = await prisma.mention.create({
    data: {
      companyId: companyOne.id,
      platform: 'YANDEX',
      type: 'REVIEW',
      sourceId: yandexSource.id,
      companySourceTargetId: acmeYandexTarget.id,
      externalMentionId: 'yandex:review:2',
      url: 'https://yandex.ru/maps/org/acme/reviews/2',
      title: 'Задержали доставку',
      content: 'Не рекомендую, задержали доставку и ответили не сразу.',
      normalizedContent: 'не рекомендую задержали доставку и ответили не сразу',
      author: 'Дмитрий',
      publishedAt: new Date(Date.now() - 1000 * 60 * 45),
      ratingValue: 2,
      sentiment: 'NEGATIVE',
      status: 'NEW',
      hash: 'seed-hash-5'
    }
  }).catch(async () => prisma.mention.findFirstOrThrow({ where: { externalMentionId: 'yandex:review:2' } }))

  await prisma.mention.create({
    data: {
      companyId: companyTwo.id,
      platform: 'WEB',
      type: 'ARTICLE',
      sourceId: webSource.id,
      companySourceTargetId: northwindWebTarget.id,
      externalMentionId: 'web:article:2',
      url: 'https://retail.example.com/northwind',
      title: 'Northwind в отраслевом обзоре',
      content: 'Northwind Market упоминается как быстрорастущий retail-проект.',
      normalizedContent: 'northwind market упоминается как быстрорастущий retail проект',
      author: 'Retail Observer',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
      sentiment: 'POSITIVE',
      status: 'NEW',
      hash: 'seed-hash-6'
    }
  }).catch(() => null)

  await prisma.ratingSnapshot.createMany({
    data: [
      {
        companyId: companyOne.id,
        sourceId: yandexSource.id,
        companySourceTargetId: acmeYandexTarget.id,
        platform: 'YANDEX',
        ratingValue: 4.8,
        reviewsCount: 128,
        capturedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)
      },
      {
        companyId: companyOne.id,
        sourceId: googleSource.id,
        companySourceTargetId: acmeGoogleTarget.id,
        platform: 'GOOGLE',
        ratingValue: 4.3,
        reviewsCount: 84,
        capturedAt: new Date(Date.now() - 1000 * 60 * 60 * 24)
      }
    ],
    skipDuplicates: false
  }).catch(() => null)

  await prisma.aIReplyDraft.create({
    data: {
      companyId: companyOne.id,
      mentionId: negativeMention.id,
      createdByUserId: user.id,
      languageCode: 'ru',
      tone: 'professional',
      promptVersion: 'mvp-v1',
      draftText: 'Спасибо за обратную связь. Нам жаль, что у вас был такой опыт. Мы уже передали информацию в поддержку и свяжемся с вами.',
      status: 'READY',
      modelName: 'stub-reply-model'
    }
  }).catch(() => null)

  await prisma.notificationRule.create({
    data: {
      workspaceId: workspace.id,
      companyId: companyOne.id,
      name: 'Negative mention alerts',
      isActive: true,
      channel: 'IN_APP',
      type: 'NEW_NEGATIVE_MENTION',
      sentimentFilter: 'NEGATIVE'
    }
  }).catch(() => null)

  await prisma.jobLog.createMany({
    data: [
      {
        companyId: companyOne.id,
        sourceId: webSource.id,
        triggeredByUserId: user.id,
        queueName: 'source_discovery',
        jobName: 'source.discovery',
        jobStatus: 'SUCCESS',
        startedAt: new Date(Date.now() - 1000 * 60 * 20),
        finishedAt: new Date(Date.now() - 1000 * 60 * 19),
        itemsDiscovered: 4,
        itemsCreated: 2,
        itemsUpdated: 1,
        itemsDeduped: 0
      },
      {
        companyId: companyOne.id,
        sourceId: yandexSource.id,
        triggeredByUserId: user.id,
        queueName: 'reviews_sync',
        jobName: 'reviews.sync',
        jobStatus: 'SUCCESS',
        startedAt: new Date(Date.now() - 1000 * 60 * 50),
        finishedAt: new Date(Date.now() - 1000 * 60 * 49),
        itemsDiscovered: 3,
        itemsCreated: 2,
        itemsUpdated: 0,
        itemsDeduped: 1
      }
    ],
    skipDuplicates: false
  }).catch(() => null)

  console.log('Seed complete')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
