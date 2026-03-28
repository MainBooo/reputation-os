export interface SourceAdapter {
  discoverTargets(input: any): Promise<any[]>
  fetchMentions(target: any): Promise<any[]>
  fetchRatingSnapshot(target: any): Promise<any | null>
}
