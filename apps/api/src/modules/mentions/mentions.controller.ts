import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { MentionsService } from './mentions.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { ListCompanyMentionsDto } from './dto/list-company-mentions.dto'
import { UpdateMentionStatusDto } from './dto/update-mention-status.dto'

@UseGuards(JwtAuthGuard)
@Controller()
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @Get('companies/:id/mentions')
  findByCompany(@CurrentUser() user: AuthUser, @Param('id') companyId: string, @Query() query: ListCompanyMentionsDto) {
    return this.mentionsService.findByCompany(user.id, companyId, query)
  }

  @Get('mentions/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mentionsService.findOne(user.id, id)
  }

  @Patch('mentions/:id/status')
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMentionStatusDto) {
    return this.mentionsService.updateStatus(user.id, id, dto)
  }
}
