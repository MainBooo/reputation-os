import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { SuperAdminGuard } from '../../common/guards/super-admin.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { AdminService } from './admin.service'
import { AuditLogService } from './audit-log.service'
import { SystemHealthService } from './system-health.service'
import { AdminUsersQueryDto } from './dto/admin-users-query.dto'
import { AdminWorkspacesQueryDto } from './dto/admin-workspaces-query.dto'
import { AdminUpdateUserRoleDto } from './dto/admin-update-user-role.dto'
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto'
import { AdminUpdateWorkspaceStatusDto } from './dto/admin-update-workspace-status.dto'
import { AdminWorkspaceBillingDto } from './dto/admin-workspace-billing.dto'
import { AdminAuditLogsQueryDto } from './dto/admin-audit-logs-query.dto'
import { UpdateAdminUserDto } from './dto/update-admin-user.dto'

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditLog: AuditLogService,
    private readonly healthService: SystemHealthService
  ) {}

  @Get('overview')
  overview() {
    return this.adminService.getOverview()
  }

  @Get('users')
  getUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.getUsers(query)
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto
  ) {
    return this.adminService.updateUser(actor.id, id, dto)
  }

  @Patch('users/:id/role')
  updateUserRole(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserRoleDto
  ) {
    return this.adminService.updateUserRole(actor.id, actor.email ?? '', id, dto)
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserStatusDto
  ) {
    return this.adminService.updateUserStatus(actor.id, actor.email ?? '', id, dto)
  }

  @Delete('users/:id')
  deleteUser(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string
  ) {
    return this.adminService.deleteUser(actor.id, actor.email ?? '', id)
  }

  @Get('workspaces')
  getWorkspaces(@Query() query: AdminWorkspacesQueryDto) {
    return this.adminService.getWorkspaces(query)
  }

  @Get('workspaces/:id')
  getWorkspaceById(@Param('id') id: string) {
    return this.adminService.getWorkspaceById(id)
  }

  @Patch('workspaces/:id/status')
  updateWorkspaceStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateWorkspaceStatusDto
  ) {
    return this.adminService.updateWorkspaceStatus(actor.id, actor.email ?? '', id, dto)
  }

  @Get('plans')
  getPlans() {
    return this.adminService.getPlans()
  }

  @Get('billing')
  getBillingOverview() {
    return this.adminService.getBillingOverview()
  }

  @Patch('workspaces/:id/billing')
  updateWorkspaceBilling(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminWorkspaceBillingDto
  ) {
    return this.adminService.updateWorkspaceBilling(actor.id, actor.email ?? '', id, dto)
  }

  @Get('audit-logs')
  getAuditLogs(@Query() query: AdminAuditLogsQueryDto) {
    return this.auditLog.query(query)
  }

  @Get('system-health')
  getSystemHealth() {
    return this.healthService.getHealth()
  }
}
