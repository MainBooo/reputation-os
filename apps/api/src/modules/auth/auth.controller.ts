import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/welcome-seen')
  markWelcomeSeen(@CurrentUser() user: AuthUser) {
    return this.authService.markWelcomeSeen(user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/delete-preview')
  getDeletePreview(@CurrentUser() user: AuthUser) {
    return this.authService.getDeletePreview(user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  deleteMe(@CurrentUser() user: AuthUser) {
    return this.authService.deleteMyAccount(user.id)
  }
}
