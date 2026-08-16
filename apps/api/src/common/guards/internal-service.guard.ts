import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { timingSafeEqual } from 'crypto'

// Guards cron/internal-only endpoints (currently /internal/jobs/tick and
// /internal/jobs/reconcile) that have no per-user identity to check against —
// there's no JwtAuthGuard equivalent for "this call came from our own cron",
// so a shared secret in a header is the mechanism (see Stage 6 of the sale-
// readiness pass: these were previously reachable by anyone on the internet).
//
// Secret comes ONLY from INTERNAL_JOBS_SECRET (never a literal fallback —
// missing config fails closed, not open). Comparison is constant-time to
// avoid a timing side-channel on the secret. Never accept it via query
// string (would land in access logs/proxies) — header only.
@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const expected = process.env.INTERNAL_JOBS_SECRET

    if (!expected) {
      throw new ForbiddenException('Internal endpoint is not configured')
    }

    const provided = request.headers['x-internal-secret']

    if (typeof provided !== 'string' || !constantTimeEqual(provided, expected)) {
      throw new ForbiddenException('Invalid internal service credentials')
    }

    return true
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  if (bufA.length !== bufB.length) {
    // Compare against itself so a length mismatch doesn't short-circuit and
    // leak timing information about the expected secret's length.
    timingSafeEqual(bufA, bufA)
    return false
  }

  return timingSafeEqual(bufA, bufB)
}
