import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable, tap } from 'rxjs'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()
    const startedAt = Date.now()
    return next.handle().pipe(tap(() => {
      const duration = Date.now() - startedAt
      console.log(`${req.method} ${req.url} ${duration}ms`)
    }))
  }
}
