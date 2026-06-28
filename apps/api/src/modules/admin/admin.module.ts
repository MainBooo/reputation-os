import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AuditLogService } from './audit-log.service'
import { SystemHealthService } from './system-health.service'

@Module({
  controllers: [AdminController],
  providers: [AdminService, AuditLogService, SystemHealthService],
  exports: [AuditLogService]
})
export class AdminModule {}
