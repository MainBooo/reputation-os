# Final consistency audit

## Checked areas

1. Prisma model names vs backend/worker/frontend naming
2. Enum values across schema, backend, worker, frontend
3. Backend route paths vs frontend API clients
4. Worker queue names and job names
5. VK 3-mode architecture across schema/API/worker/frontend/seed
6. Required env variables for local run
7. First-run blockers
8. Seed coverage for dashboard/inbox/ratings/analytics/VK
9. docker/prisma/start commands alignment
10. VPS startup flow

## Findings to preserve

- Stable models:
  - User
  - Workspace
  - WorkspaceMember
  - Company
  - CompanyAlias
  - Source
  - CompanySourceTarget
  - Mention
  - RatingSnapshot
  - AIReplyDraft
  - NotificationRule
  - JobLog
  - VkSearchProfile
  - VkTrackedCommunity
  - VkTrackedPost

- Stable enums:
  - Platform
  - SourceType
  - MentionType
  - MentionStatus
  - Sentiment
  - WorkspaceRole
  - JobStatus
  - NotificationChannel
  - NotificationType
  - VkMonitoringMode
  - VkTrackedCommunityMode
  - VkPostDiscoveryStatus

- Stable routes:
  - /auth/register
  - /auth/login
  - /auth/me
  - /workspaces
  - /companies
  - /companies/:id
  - /companies/:id/aliases
  - /companies/:id/sources
  - /companies/:id/mentions
  - /mentions/:id
  - /mentions/:id/status
  - /companies/:id/ratings/history
  - /companies/:id/ratings/overview
  - /companies/:id/analytics/overview
  - /companies/:id/analytics/sentiment
  - /companies/:id/analytics/platforms
  - /mentions/:id/generate-reply
  - /companies/:id/discover-sources
  - /companies/:id/start-sync
  - /internal/jobs/tick
  - /internal/jobs/reconcile
  - /companies/:id/vk/search-profiles
  - /companies/:id/vk/communities
  - /companies/:id/vk/posts
  - /companies/:id/vk/overview
  - /companies/:id/vk/run-brand-search
  - /companies/:id/vk/run-community-sync
  - /companies/:id/vk/run-owned-community-sync

## Important notes

### 1. Unpack order
Unpack archives into the same monorepo root:
1. 01-foundation.zip
2. 02-api.zip
3. 03-worker.zip
4. 04-frontend.zip
5. 05-infra-seed.zip
6. 06-patches-and-runbook.zip

### 2. Prisma is source of truth
If a code mismatch appears during future extension:
- fix code
- do not rename Prisma models or enums silently

### 3. VK mode consistency
The 3 modes stay:
- BRAND_SEARCH
- PRIORITY_COMMUNITIES
- OWNED_COMMUNITY

Community table mode stays:
- PRIORITY_COMMUNITY
- OWNED_COMMUNITY

### 4. Current known implementation boundary
This delivery is runnable/demo-oriented and architecture-consistent.
External platform adapters are hybrid:
- mock/demo-first
- real integration-ready

### 5. Health
Confirmed:
- API health endpoint exists at `/api/health`
- worker bootstraps as application context
