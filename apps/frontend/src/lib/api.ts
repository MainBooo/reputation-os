// Compatibility entry point for older imports. Keep one fail-closed API
// implementation so HTTP and network errors cannot silently become `null`.
export { apiFetch, isApiError } from '../../lib/api/client'
