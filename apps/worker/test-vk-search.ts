import { VkPlaywrightSearchService } from './src/services/vk/vk-playwright-search.service'

async function main() {
  const service = new VkPlaywrightSearchService()

  const results = await service.searchPosts(
    ['stereopeople'],
    'test-workspace',
    'test-company'
  )

  console.log('RESULT COUNT:', results.length)

  for (const r of results.slice(0, 10)) {
    console.log('--- POST ---')
    console.log('URL:', r.postUrl)
    console.log('OWNER:', r.ownerId)
    console.log('POST:', r.postId)
    console.log('TEXT:', (r.text || '').slice(0, 300))
    console.log('COMMENTS:', r.comments.length)
    console.log('FIRST COMMENTS:', r.comments.slice(0, 3))
  }
}

main().catch((e) => {
  console.error('TEST_FATAL', e)
  process.exit(1)
})
