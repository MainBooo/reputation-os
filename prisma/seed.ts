import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('demo123', 10)

  // ─── Demo user ───────────────────────────────────────────────────────────
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

  // ─── Demo workspace ──────────────────────────────────────────────────────
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

  // ─── Sources (idempotent) ────────────────────────────────────────────────
  const yandexSource = await prisma.source.findFirst({
    where: { workspaceId: workspace.id, platform: 'YANDEX' }
  }) ?? await prisma.source.create({
    data: {
      workspaceId: workspace.id,
      name: 'Yandex Reviews',
      platform: 'YANDEX',
      type: 'REVIEW_FEED',
      isEnabled: true
    }
  })

  const twogisSource = await prisma.source.findFirst({
    where: { workspaceId: workspace.id, platform: 'TWOGIS' }
  }) ?? await prisma.source.create({
    data: {
      workspaceId: workspace.id,
      name: '2ГИС Reviews',
      platform: 'TWOGIS',
      type: 'REVIEW_FEED',
      isEnabled: true
    }
  })

  // ─── Company: Руки Вверх Бар ─────────────────────────────────────────────
  const rukiVverh = await prisma.company.findFirst({
    where: { workspaceId: workspace.id, name: 'Руки Вверх Бар' }
  }) ?? await prisma.company.create({
    data: {
      workspaceId: workspace.id,
      name: 'Руки Вверх Бар',
      normalizedName: 'руки вверх бар',
      city: 'Москва',
      normalizedCity: 'москва',
      industry: 'Бары, клубы',
      isActive: true
    }
  })

  await prisma.companyAlias.createMany({
    data: [
      { companyId: rukiVverh.id, value: 'Руки Вверх', normalizedValue: 'руки вверх', priority: 10, isPrimary: true },
      { companyId: rukiVverh.id, value: 'Руки Вверх Бар', normalizedValue: 'руки вверх бар', priority: 20, isPrimary: false }
    ],
    skipDuplicates: true
  })

  const rukiYandexTarget = await prisma.companySourceTarget.findFirst({
    where: { companyId: rukiVverh.id, sourceId: yandexSource.id }
  }) ?? await prisma.companySourceTarget.create({
    data: {
      companyId: rukiVverh.id,
      sourceId: yandexSource.id,
      externalPlaceId: 'ruki-vverh-yandex-place',
      externalUrl: 'https://yandex.ru/maps/org/ruki_vverh_bar/123',
      displayName: 'Руки Вверх Бар на Яндекс',
      isActive: true
    }
  })

  const rukiTwogisTarget = await prisma.companySourceTarget.findFirst({
    where: { companyId: rukiVverh.id, sourceId: twogisSource.id }
  }) ?? await prisma.companySourceTarget.create({
    data: {
      companyId: rukiVverh.id,
      sourceId: twogisSource.id,
      externalPlaceId: 'ruki-vverh-2gis-place',
      externalUrl: 'https://2gis.ru/moscow/firm/ruki-vverh-bar',
      displayName: 'Руки Вверх Бар на 2ГИС',
      isActive: true
    }
  })

  // Отзывы для Руки Вверх Бар
  await prisma.mention.createMany({
    data: [
      {
        companyId: rukiVverh.id,
        platform: 'YANDEX',
        type: 'REVIEW',
        sourceId: yandexSource.id,
        companySourceTargetId: rukiYandexTarget.id,
        externalMentionId: 'demo:ruki:yandex:1',
        url: 'https://yandex.ru/maps/org/ruki_vverh/reviews/1',
        title: 'Отличное место!',
        content: 'Атмосфера супер, музыка живая, персонал вежливый. Обязательно вернёмсэ!',
        normalizedContent: 'атмосфера супер музыка живая персонал вежливый обязательно вернёмсэ',
        author: 'Анастасия К.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
        ratingValue: 5,
        sentiment: 'POSITIVE',
        status: 'NEW',
        hash: 'demo-ruki-yandex-1'
      },
      {
        companyId: rukiVverh.id,
        platform: 'YANDEX',
        type: 'REVIEW',
        sourceId: yandexSource.id,
        companySourceTargetId: rukiYandexTarget.id,
        externalMentionId: 'demo:ruki:yandex:2',
        url: 'https://yandex.ru/maps/org/ruki_vverh/reviews/2',
        title: 'Долго ждали столик',
        content: 'Место классное, но в выходные очередь на час. Стоит бронировать заранее.',
        normalizedContent: 'место классное но в выходные очередь на час стоит бронировать заранее',
        author: 'Игорь П.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
        ratingValue: 3,
        sentiment: 'NEUTRAL',
        status: 'NEW',
        hash: 'demo-ruki-yandex-2'
      },
      {
        companyId: rukiVverh.id,
        platform: 'YANDEX',
        type: 'REVIEW',
        sourceId: yandexSource.id,
        companySourceTargetId: rukiYandexTarget.id,
        externalMentionId: 'demo:ruki:yandex:3',
        url: 'https://yandex.ru/maps/org/ruki_vverh/reviews/3',
        title: 'Грубый охранник',
        content: 'Не понравилось отношение на входе. Охранник был груб без повода.',
        normalizedContent: 'не понравилось отношение на входе охранник был груб без повода',
        author: 'Максим Д.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 30),
        ratingValue: 2,
        sentiment: 'NEGATIVE',
        status: 'NEW',
        hash: 'demo-ruki-yandex-3'
      },
      {
        companyId: rukiVverh.id,
        platform: 'TWOGIS',
        type: 'REVIEW',
        sourceId: twogisSource.id,
        companySourceTargetId: rukiTwogisTarget.id,
        externalMentionId: 'demo:ruki:2gis:1',
        url: 'https://2gis.ru/moscow/firm/ruki-vverh-bar/reviews/1',
        title: 'Лучший бар района',
        content: 'Коктейли отменные, цены адекватные. Диджей по пятницам — огонь.',
        normalizedContent: 'коктейли отменные цены адекватные диджей по пятницам огонь',
        author: 'Светлана Р.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
        ratingValue: 5,
        sentiment: 'POSITIVE',
        status: 'NEW',
        hash: 'demo-ruki-2gis-1'
      }
    ],
    skipDuplicates: true
  })

  await prisma.ratingSnapshot.createMany({
    data: [
      {
        companyId: rukiVverh.id,
        sourceId: yandexSource.id,
        companySourceTargetId: rukiYandexTarget.id,
        platform: 'YANDEX',
        ratingValue: 4.5,
        reviewsCount: 323,
        capturedAt: new Date(Date.now() - 1000 * 60 * 60 * 3)
      },
      {
        companyId: rukiVverh.id,
        sourceId: twogisSource.id,
        companySourceTargetId: rukiTwogisTarget.id,
        platform: 'TWOGIS',
        ratingValue: 4.7,
        reviewsCount: 187,
        capturedAt: new Date(Date.now() - 1000 * 60 * 60 * 3)
      }
    ],
    skipDuplicates: false
  }).catch(() => null)

  // ─── Company: Stereopeople ────────────────────────────────────────────────
  const stereopeople = await prisma.company.findFirst({
    where: { workspaceId: workspace.id, name: 'Stereopeople' }
  }) ?? await prisma.company.create({
    data: {
      workspaceId: workspace.id,
      name: 'Stereopeople',
      normalizedName: 'stereopeople',
      city: 'Москва',
      normalizedCity: 'москва',
      industry: 'Клубы',
      isActive: true
    }
  })

  await prisma.companyAlias.createMany({
    data: [
      { companyId: stereopeople.id, value: 'Stereopeople', normalizedValue: 'stereopeople', priority: 10, isPrimary: true }
    ],
    skipDuplicates: true
  })

  const stereoYandexTarget = await prisma.companySourceTarget.findFirst({
    where: { companyId: stereopeople.id, sourceId: yandexSource.id }
  }) ?? await prisma.companySourceTarget.create({
    data: {
      companyId: stereopeople.id,
      sourceId: yandexSource.id,
      externalPlaceId: 'stereopeople-yandex-place',
      externalUrl: 'https://yandex.ru/maps/org/stereopeople/456',
      displayName: 'Stereopeople на Яндекс',
      isActive: true
    }
  })

  const stereoTwogisTarget = await prisma.companySourceTarget.findFirst({
    where: { companyId: stereopeople.id, sourceId: twogisSource.id }
  }) ?? await prisma.companySourceTarget.create({
    data: {
      companyId: stereopeople.id,
      sourceId: twogisSource.id,
      externalPlaceId: 'stereopeople-2gis-place',
      externalUrl: 'https://2gis.ru/moscow/firm/stereopeople',
      displayName: 'Stereopeople на 2ГИС',
      isActive: true
    }
  })

  // Отзывы для Stereopeople
  await prisma.mention.createMany({
    data: [
      {
        companyId: stereopeople.id,
        platform: 'YANDEX',
        type: 'REVIEW',
        sourceId: yandexSource.id,
        companySourceTargetId: stereoYandexTarget.id,
        externalMentionId: 'demo:stereo:yandex:1',
        url: 'https://yandex.ru/maps/org/stereopeople/reviews/1',
        title: 'Крутой звук',
        content: 'Звук на концерте был невероятный. Артист отработал на 100%.',
        normalizedContent: 'звук на концерте был невероятный артист отработал на 100%',
        author: 'Олег В.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
        ratingValue: 5,
        sentiment: 'POSITIVE',
        status: 'NEW',
        hash: 'demo-stereo-yandex-1'
      },
      {
        companyId: stereopeople.id,
        platform: 'YANDEX',
        type: 'REVIEW',
        sourceId: yandexSource.id,
        companySourceTargetId: stereoYandexTarget.id,
        externalMentionId: 'demo:stereo:yandex:2',
        url: 'https://yandex.ru/maps/org/stereopeople/reviews/2',
        title: 'Дорогие напитки',
        content: 'Атмосфера хорошая, но цены на баре завышены 600р за коктейль — ьноговато.',
        normalizedContent: 'атмосфера хорошая но цены на баре завышены 600р за коктейль многовато',
        author: 'Наталья С.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
        ratingValue: 3,
        sentiment: 'NEUTRAL',
        status: 'NEW',
        hash: 'demo-stereo-yandex-2'
      },
      {
        companyId: stereopeople.id,
        platform: 'TWOGIS',
        type: 'REVIEW',
        sourceId: twogisSource.id,
        companySourceTargetId: stereoTwogisTarget.id,
        externalMentionId: 'demo:stereo:2gis:1',
        url: 'https://2gis.ru/moscow/firm/stereopeople/reviews/1',
        title: 'Не пустили без маски',
        content: 'Фейсконтроль странный. Не объяснили причину отказа.',
        normalizedContent: 'фейсконтроль странный не объяснили причину отказа',
        author: 'Артём К.',
        publishedAt: new Date(Date.now() - 1000 * 60 * 50),
        ratingValue: 1,
        sentiment: 'NEGATIVE',
        status: 'NEW',
        hash: 'demo-stereo-2gis-1'
      }
    ],
    skipDuplicates: true
  })

  await prisma.ratingSnapshot.createMany({
    data: [
      {
        companyId: stereopeople.id,
        sourceId: yandexSource.id,
        companySourceTargetId: stereoYandexTarget.id,
        platform: 'YANDEX',
        ratingValue: 4.2,
        reviewsCount: 122,
        capturedAt: new Date(Date.now() - 1000 * 60 * 60 * 3)
      },
      {
        companyId: stereopeople.id,
        sourceId: twogisSource.id,
        companySourceTargetId: stereoTwogisTarget.id,
        platform: 'TWOGIS',
        ratingValue: 4.0,
        reviewsCount: 98,
        capturedAt: new Date(Date.now() - 1000 * 60 * 60 * 3)
      }
    ],
    skipDuplicates: false
  }).catch(() => null)

  // ─── Notification rule ───────────────────────────────────────────────────
  await prisma.notificationRule.createMany({
    data: [
      {
        workspaceId: workspace.id,
        companyId: rukiVverh.id,
        name: 'Негативные отзывы — Руки Жверх',
        isActive: true,
        channel: 'IN_APP',
        type: 'NEW_NEGATIVE_MENTION',
        sentimentFilter: 'NEGATIVE'
      },
      {
        workspaceId: workspace.id,
        companyId: stereopeople.id,
        name: 'Негативные отзывы — Stereopeople',
        isActive: true,
        channel: 'IN_APP',
        type: 'NEW_NEGATIVE_MENTION',
        sentimentFilter: 'NEGATIVE'
      }
    ],
    skipDuplicates: true
  }).catch(() => null)

  console.log('✅ Demo seed complete: Руки Жверх Бар + Stereopeople')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
