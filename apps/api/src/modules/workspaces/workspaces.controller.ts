import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { WorkspacesService } from './workspaces.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto'
import { UpdateWorkspaceMemberRoleDto } from './dto/update-workspace-member-role.dto'
import { CreateWorkspaceInviteDto } from './dto/create-workspace-invite.dto'
import { AcceptWorkspaceInviteDto } from './dto/accept-workspace-invite.dto'

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

  @Get(':id/members')
  findMembers(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspacesService.findMembers(user.id, id)
  }

  @Post(':id/members')
  addMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddWorkspaceMemberDto) {
    return this.workspacesService.addMember(user.id, id, dto)
  }

  @Patch(':id/members/:memberId')
  updateMemberRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateWorkspaceMemberRoleDto
  ) {
    return this.workspacesService.updateMemberRole(user.id, id, memberId, dto)
  }

  @Delete(':id/members/:memberId')
  removeMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('memberId') memberId: string) {
    return this.workspacesService.removeMember(user.id, id, memberId)
  }

  @Get(':id/invites')
  findInvites(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspacesService.findInvites(user.id, id)
  }

  @Post(':id/invites')
  createInvite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateWorkspaceInviteDto
  ) {
    return this.workspacesService.createInvite(user.id, id, dto)
  }

  @Post('invites/accept')
  acceptInvite(
    @CurrentUser() user: AuthUser,
    @Body() dto: AcceptWorkspaceInviteDto
  ) {
    return this.workspacesService.acceptInvite(user.id, dto.token)
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspacesService.findOneForUser(user.id, id)
  }
}
