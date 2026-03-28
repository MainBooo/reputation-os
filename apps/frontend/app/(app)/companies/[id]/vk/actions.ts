export async function runBrandSearch(companyId: string) {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/companies/${companyId}/vk/run-brand-search`, {
    method: 'POST'
  })
}

export async function runCommunitySync(companyId: string) {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/companies/${companyId}/vk/run-community-sync`, {
    method: 'POST'
  })
}

export async function runOwnedSync(companyId: string) {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/companies/${companyId}/vk/run-owned-community-sync`, {
    method: 'POST'
  })
}
