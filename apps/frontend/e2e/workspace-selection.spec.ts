import { test, expect } from '@playwright/test'
import { filterByWorkspace, pickWorkspaceId } from '../lib/workspace-selection'

const workspaces = [{ id: 'workspace-a' }, { id: 'workspace-b' }]
const companies = [
  { id: 'company-a', workspaceId: 'workspace-a' },
  { id: 'company-b', workspaceId: 'workspace-b' }
]

test('data is filtered to the explicitly selected accessible workspace', () => {
  const selected = pickWorkspaceId(workspaces, 'workspace-b')

  expect(selected).toBe('workspace-b')
  expect(filterByWorkspace(companies, selected)).toEqual([
    { id: 'company-b', workspaceId: 'workspace-b' }
  ])
})

test('an unknown workspace id is replaced with the first accessible workspace', () => {
  const selected = pickWorkspaceId(workspaces, 'foreign-workspace')

  expect(selected).toBe('workspace-a')
  expect(filterByWorkspace(companies, selected)).toEqual([
    { id: 'company-a', workspaceId: 'workspace-a' }
  ])
})

test('an account without an accessible workspace never receives unscoped data', () => {
  const selected = pickWorkspaceId([], 'foreign-workspace')

  expect(selected).toBe('')
  expect(filterByWorkspace(companies, selected)).toEqual([])
})
