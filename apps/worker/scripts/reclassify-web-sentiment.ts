import { PrismaClient, Sentiment } from '@prisma/client'
import { classifySentiment } from '../src/common/utils/sentiment.util'

const prisma = new PrismaClient()

async function main() {
  const items = await prisma.mention.findMany({
    where: { platform: 'WEB' },
    select: { id: true, title: true, content: true, sentiment: true }
  })

  let updated = 0

  for (const item of items) {
    const text = [item.title, item.content].filter(Boolean).join('\n')
    const next = classifySentiment(text)

    if (next === 'UNKNOWN') continue
    if (next === item.sentiment) continue

    await prisma.mention.update({
      where: { id: item.id },
      data: { sentiment: next as Sentiment }
    })

    updated += 1
    console.log(`UPDATED ${item.id}: ${item.sentiment} -> ${next}`)
  }

  console.log(`DONE checked=${items.length} updated=${updated}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
