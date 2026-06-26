import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

@Injectable()
export class DemoProtectionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    if (user?.email === 'demo@reputation.local') {
      throw new ForbiddenException('Demo account: action not allowed')
    }
    return true
  }
}
