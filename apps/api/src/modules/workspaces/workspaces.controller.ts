import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { WorkspacesService } from './workspaces.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'

@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.workspacesService.findAllForUser(user.id)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.id, dto)
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspacesService.findOneForUser(user.id, id)
  }
}
