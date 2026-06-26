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

  console.log('✅ Demo seed complete: workspace ready')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
