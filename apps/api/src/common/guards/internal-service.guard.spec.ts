import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { InternalServiceGuard } from './internal-service.guard'

function mockContext(headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers, query: {} })
    })
  } as unknown as ExecutionContext
}

describe('InternalServiceGuard', () => {
  const guard = new InternalServiceGuard()
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('fails closed when INTERNAL_JOBS_SECRET is not configured, even with a header present', () => {
    delete process.env.INTERNAL_JOBS_SECRET
    expect(() => guard.canActivate(mockContext({ 'x-internal-secret': 'anything' }))).toThrow(
      ForbiddenException
    )
  })

  it('rejects a request with no secret header', () => {
    process.env.INTERNAL_JOBS_SECRET = 'correct-secret'
    expect(() => guard.canActivate(mockContext({}))).toThrow(ForbiddenException)
  })

  it('rejects a request with the wrong secret', () => {
    process.env.INTERNAL_JOBS_SECRET = 'correct-secret'
    expect(() => guard.canActivate(mockContext({ 'x-internal-secret': 'wrong-secret' }))).toThrow(
      ForbiddenException
    )
  })

  it('rejects a secret of different length without throwing an unrelated error', () => {
    process.env.INTERNAL_JOBS_SECRET = 'correct-secret'
    expect(() => guard.canActivate(mockContext({ 'x-internal-secret': 'short' }))).toThrow(
      ForbiddenException
    )
  })

  it('accepts a request with the matching secret header', () => {
    process.env.INTERNAL_JOBS_SECRET = 'correct-secret'
    expect(guard.canActivate(mockContext({ 'x-internal-secret': 'correct-secret' }))).toBe(true)
  })

  it('does not read the secret from the query string', () => {
    process.env.INTERNAL_JOBS_SECRET = 'correct-secret'
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, query: { secret: 'correct-secret' } })
      })
    } as unknown as ExecutionContext

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })
})
