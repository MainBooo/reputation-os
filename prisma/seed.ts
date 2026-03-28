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

  const vkBrandSource = await prisma.source.create({
    data: {
      workspaceId: workspace.id,
      name: 'VK Brand Search',
      platform: 'VK',
      type: 'VK_BRAND_SEARCH',
      isEnabled: true
    }
  }).catch(async () => prisma.source.findFirstOrThrow({ where: { workspaceId: workspace.id, name: 'VK Brand Search' } }))

  const vkOwnedSource = await prisma.source.create({
    data: {
      workspaceId: workspace.id,
      name: 'VK Owned Community',
      platform: 'VK',
      type: 'VK_OWNED_COMMUNITY',
      isEnabled: true
    }
  }).catch(async () => prisma.source.findFirstOrThrow({ where: { workspaceId: workspace.id, name: 'VK Owned Community' } }))

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

  const brandProfileOne = await prisma.vkSearchProfile.create({
    data: {
      companyId: companyOne.id,
      query: 'Acme',
      normalizedQuery: 'acme',
      priority: 10,
      isActive: true,
      mode: 'BRAND_SEARCH'
    }
  }).catch(async () => prisma.vkSearchProfile.findFirstOrThrow({ where: { companyId: companyOne.id, normalizedQuery: 'acme', mode: 'BRAND_SEARCH' } }))

  await prisma.vkSearchProfile.create({
    data: {
      companyId: companyOne.id,
      query: 'Acme Corp',
      normalizedQuery: 'acme corp',
      priority: 20,
      isActive: true,
      mode: 'BRAND_SEARCH'
    }
  }).catch(() => null)

  const priorityCommunity = await prisma.vkTrackedCommunity.create({
    data: {
      companyId: companyOne.id,
      mode: 'PRIORITY_COMMUNITY',
      vkCommunityId: 'club123456',
      screenName: 'startup_reviews',
      title: 'Startup Reviews',
      url: 'https://vk.com/startup_reviews',
      isActive: true
    }
  }).catch(async () => prisma.vkTrackedCommunity.findFirstOrThrow({ where: { companyId: companyOne.id, vkCommunityId: 'club123456', mode: 'PRIORITY_COMMUNITY' } }))

  const ownedCommunity = await prisma.vkTrackedCommunity.create({
    data: {
      companyId: companyOne.id,
      mode: 'OWNED_COMMUNITY',
      vkCommunityId: 'club999999',
      screenName: 'acme_official',
      title: 'Acme Official',
      url: 'https://vk.com/acme_official',
      isActive: true
    }
  }).catch(async () => prisma.vkTrackedCommunity.findFirstOrThrow({ where: { companyId: companyOne.id, vkCommunityId: 'club999999', mode: 'OWNED_COMMUNITY' } }))

  const vkTrackedPostOne = await prisma.vkTrackedPost.create({
    data: {
      companyId: companyOne.id,
      trackedCommunityId: priorityCommunity.id,
      ownerId: '-123456',
      postId: '101',
      postKey: 'vk:-123456:101',
      text: 'Кто пользовался услугами Acme? Как впечатления?',
      url: 'https://vk.com/wall-123456_101',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      commentsCount: 12,
      discoveryStatus: 'RELEVANT',
      relevanceScore: 4.5
    }
  }).catch(async () => prisma.vkTrackedPost.findFirstOrThrow({ where: { companyId: companyOne.id, postKey: 'vk:-123456:101' } }))

  const vkTrackedPostTwo = await prisma.vkTrackedPost.create({
    data: {
      companyId: companyOne.id,
      trackedCommunityId: ownedCommunity.id,
      ownerId: '-999999',
      postId: '202',
      postKey: 'vk:-999999:202',
      text: 'Официальный пост Acme про новый релиз',
      url: 'https://vk.com/wall-999999_202',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      commentsCount: 4,
      discoveryStatus: 'COMMENTS_SYNCED',
      relevanceScore: 5.0
    }
  }).catch(async () => prisma.vkTrackedPost.findFirstOrThrow({ where: { companyId: companyOne.id, postKey: 'vk:-999999:202' } }))

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

  await prisma.mention.create({
    data: {
      companyId: companyOne.id,
      platform: 'VK',
      type: 'VK_POST',
      sourceId: vkBrandSource.id,
      vkTrackedPostId: vkTrackedPostOne.id,
      externalMentionId: 'vk:post:-123456:101',
      url: 'https://vk.com/wall-123456_101',
      title: 'VK post mention',
      content: 'Кто пользовался услугами Acme? Как впечатления?',
      normalizedContent: 'кто пользовался услугами acme как впечатления',
      author: 'vk_user_1',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      sentiment: 'NEUTRAL',
      status: 'NEW',
      hash: 'seed-hash-4',
      metadata: { mode: 'PRIORITY_COMMUNITIES' }
    }
  }).catch(() => null)

  const vkCommentMention = await prisma.mention.create({
    data: {
      companyId: companyOne.id,
      platform: 'VK',
      type: 'VK_COMMENT',
      sourceId: vkOwnedSource.id,
      vkTrackedPostId: vkTrackedPostTwo.id,
      externalMentionId: 'vk:comment:-999999:202:501',
      url: 'https://vk.com/wall-999999_202?reply=501',
      title: 'VK comment mention',
      content: 'Не рекомендую, задержали доставку и ответили не сразу.',
      normalizedContent: 'не рекомендую задержали доставку и ответили не сразу',
      author: 'vk_user_2',
      publishedAt: new Date(Date.now() - 1000 * 60 * 45),
      sentiment: 'NEGATIVE',
      status: 'NEW',
      hash: 'seed-hash-5',
      metadata: { mode: 'OWNED_COMMUNITY' }
    }
  }).catch(async () => prisma.mention.findFirstOrThrow({ where: { externalMentionId: 'vk:comment:-999999:202:501' } }))

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
      mentionId: vkCommentMention.id,
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
      platformFilter: 'VK',
      sentimentFilter: 'NEGATIVE'
    }
  }).catch(() => null)

  await prisma.jobLog.createMany({
    data: [
      {
        companyId: companyOne.id,
        sourceId: vkBrandSource.id,
        triggeredByUserId: user.id,
        queueName: 'vk_brand_search_discovery',
        jobName: 'vk.brand-search',
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
