import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { SuperAdminGuard } from '../../common/guards/super-admin.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { AdminService } from './admin.service'
import { UpdateAdminUserDto } from './dto/update-admin-user.dto'

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  overview() {
    return this.adminService.getOverview()
  }

  @Get('users')
  users(@Query('q') q?: string, @Query('systemRole') systemRole?: string) {
    return this.adminService.getUsers({ q, systemRole })
  }

  @Patch('users/:id')
  updateUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminService.updateUser(user.id, id, dto)
  }

  @Get('workspaces')
  workspaces() {
    return this.adminService.getWorkspaces()
  }
}
