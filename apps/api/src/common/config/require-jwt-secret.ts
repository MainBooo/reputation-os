// Shared by every place that needs JWT_SECRET (AuthModule, jwt.config.ts,
// ChatModule/ChatGateway's own JwtService instances). No literal fallback —
// a hardcoded default secret checked into source control is a secret an
// attacker can read from GitHub and use to forge tokens against any
// deployment that forgot to set its own. Fail fast at startup instead.
export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not set — refusing to start without it (no insecure fallback).')
  }
  return secret
}
