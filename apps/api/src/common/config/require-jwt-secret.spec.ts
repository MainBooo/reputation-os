import { requireJwtSecret } from './require-jwt-secret'

describe('requireJwtSecret', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('throws instead of falling back to a literal default when JWT_SECRET is unset', () => {
    delete process.env.JWT_SECRET
    expect(() => requireJwtSecret()).toThrow(/JWT_SECRET is not set/)
  })

  it('returns the configured secret when set', () => {
    process.env.JWT_SECRET = 'a-real-secret'
    expect(requireJwtSecret()).toBe('a-real-secret')
  })
})
