import { TwoGisAdapter } from './src/adapters/twogis.adapter'

async function main() {
  const adapter = new TwoGisAdapter()
  const mentions = await adapter.fetchMentions({
    id: 'manual-test',
    externalUrl: 'https://2gis.ru/moscow/firm/70000001028438390/tab/reviews?m=37.59966%2C55.782065%2F16'
  })

  console.log('TWOGIS_MENTIONS_COUNT', mentions.length)
  console.log(JSON.stringify(mentions.slice(0, 12), null, 2))
}

main().catch((error) => {
  console.error('TWOGIS_ADAPTER_TEST_FAILED', error)
  process.exit(1)
})
