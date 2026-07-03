import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { CompaniesService } from './companies.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { DemoProtectionGuard } from '../../common/guards/demo-protection.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { CreateCompanyDto } from './dto/create-company.dto'
import { UpdateCompanyDto } from './dto/update-company.dto'
import { CreateCompanyAliasDto } from './dto/create-company-alias.dto'
import { CreateCompanySourceTargetDto } from './dto/create-company-source-target.dto'
import { UpdateCompanySourceTargetDto } from './dto/update-company-source-target.dto'
import { AppThrottlerGuard } from '../../common/rate-limit/app-throttler.guard'
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.config'
import { userAndWorkspaceTracker } from '../../common/rate-limit/rate-limit-trackers'

@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.companiesService.findAll(user.id)
  }

  @UseGuards(AppThrottlerGuard)
  @Throttle({ default: { ...RATE_LIMITS.createCompany, getTracker: userAndWorkspaceTracker } })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(user.id, dto)
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.companiesService.findOne(user.id, id)
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(user.id, id, dto)
  }

  @Delete(':id')
  @UseGuards(DemoProtectionGuard)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.companiesService.remove(user.id, id)
  }

  @Post(':id/aliases')
  createAlias(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateCompanyAliasDto) {
    return this.companiesService.createAlias(user.id, id, dto)
  }

  @Delete(':id/aliases/:aliasId')
  @UseGuards(DemoProtectionGuard)
  deleteAlias(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('aliasId') aliasId: string) {
    return this.companiesService.deleteAlias(user.id, id, aliasId)
  }

  @Get(':id/sources')
  getSources(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.companiesService.getSources(user.id, id)
  }

  @Get(':id/web-sources')
  getWebSourcesOverview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.companiesService.getWebSourcesOverview(user.id, id)
  }

  @Post(':id/sources')
  createSourceTarget(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateCompanySourceTargetDto) {
    return this.companiesService.createSourceTarget(user.id, id, dto)
  }

  @Patch(':id/sources/:targetId')
  updateSourceTarget(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @Body() dto: UpdateCompanySourceTargetDto
  ) {
    return this.companiesService.updateSourceTarget(user.id, id, targetId, dto)
  }

  @Delete(':id/sources/:targetId')
  deleteSourceTarget(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('targetId') targetId: string) {
    return this.companiesService.deleteSourceTarget(user.id, id, targetId)
  }
}
