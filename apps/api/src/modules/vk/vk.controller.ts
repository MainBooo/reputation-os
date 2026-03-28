import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { VkService } from './vk.service'
import { CreateVkSearchProfileDto } from './dto/create-vk-search-profile.dto'
import { UpdateVkSearchProfileDto } from './dto/update-vk-search-profile.dto'
import { CreateVkTrackedCommunityDto } from './dto/create-vk-tracked-community.dto'
import { UpdateVkTrackedCommunityDto } from './dto/update-vk-tracked-community.dto'
import { ListVkPostsDto } from './dto/list-vk-posts.dto'

@UseGuards(JwtAuthGuard)
@Controller('companies/:id/vk')
export class VkController {
  constructor(private readonly vkService: VkService) {}

  @Get('search-profiles')
  getSearchProfiles(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.vkService.getSearchProfiles(user.id, companyId)
  }

  @Post('search-profiles')
  createSearchProfile(@CurrentUser() user: AuthUser, @Param('id') companyId: string, @Body() dto: CreateVkSearchProfileDto) {
    return this.vkService.createSearchProfile(user.id, companyId, dto)
  }

  @Patch('search-profiles/:profileId')
  updateSearchProfile(
    @CurrentUser() user: AuthUser,
    @Param('id') companyId: string,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateVkSearchProfileDto
  ) {
    return this.vkService.updateSearchProfile(user.id, companyId, profileId, dto)
  }

  @Delete('search-profiles/:profileId')
  deleteSearchProfile(@CurrentUser() user: AuthUser, @Param('id') companyId: string, @Param('profileId') profileId: string) {
    return this.vkService.deleteSearchProfile(user.id, companyId, profileId)
  }

  @Get('communities')
  getCommunities(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.vkService.getCommunities(user.id, companyId)
  }

  @Post('communities')
  createCommunity(@CurrentUser() user: AuthUser, @Param('id') companyId: string, @Body() dto: CreateVkTrackedCommunityDto) {
    return this.vkService.createCommunity(user.id, companyId, dto)
  }

  @Patch('communities/:communityId')
  updateCommunity(
    @CurrentUser() user: AuthUser,
    @Param('id') companyId: string,
    @Param('communityId') communityId: string,
    @Body() dto: UpdateVkTrackedCommunityDto
  ) {
    return this.vkService.updateCommunity(user.id, companyId, communityId, dto)
  }

  @Delete('communities/:communityId')
  deleteCommunity(@CurrentUser() user: AuthUser, @Param('id') companyId: string, @Param('communityId') communityId: string) {
    return this.vkService.deleteCommunity(user.id, companyId, communityId)
  }

  @Get('posts')
  getPosts(@CurrentUser() user: AuthUser, @Param('id') companyId: string, @Query() query: ListVkPostsDto) {
    return this.vkService.getPosts(user.id, companyId, query)
  }

  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.vkService.overview(user.id, companyId)
  }

  @Post('run-brand-search')
  runBrandSearch(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.vkService.runBrandSearch(user.id, companyId)
  }

  @Post('run-community-sync')
  runCommunitySync(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.vkService.runCommunitySync(user.id, companyId)
  }

  @Post('run-owned-community-sync')
  runOwnedCommunitySync(@CurrentUser() user: AuthUser, @Param('id') companyId: string) {
    return this.vkService.runOwnedCommunitySync(user.id, companyId)
  }

  @Post('brand-search/trigger')
  triggerBrandSearch(@Param('id') companyId: string) {
    return this.vkService.triggerBrandSearch(companyId)
  }

  @Post('priority-sync/trigger')
  triggerPrioritySync(@Param('id') companyId: string) {
    return this.vkService.triggerPrioritySync(companyId)
  }

  @Post('owned-sync/trigger')
  triggerOwnedSync(@Param('id') companyId: string) {
    return this.vkService.triggerOwnedSync(companyId)
  }
}
