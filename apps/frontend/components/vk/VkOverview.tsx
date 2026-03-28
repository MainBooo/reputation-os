import StatCard from '../ui/StatCard'

export default function VkOverview({ overview }: { overview: any }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Tracked communities" value={overview?.trackedCommunitiesCount ?? 0} />
      <StatCard label="Active search profiles" value={overview?.activeSearchProfilesCount ?? 0} />
      <StatCard label="Discovered VK posts" value={overview?.discoveredVkPostsCount ?? 0} />
      <StatCard label="Relevant VK mentions" value={overview?.relevantVkMentionsCount ?? 0} />
    </div>
  )
}
