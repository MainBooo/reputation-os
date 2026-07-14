import { Body, Controller, Delete, Get, Logger, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { AppThrottlerGuard } from '../../common/rate-limit/app-throttler.guard'
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.config'
import { ipTracker, ipAndEmailTracker } from '../../common/rate-limit/rate-limit-trackers'

const YANDEX_STATE_COOKIE = 'yandex_oauth_state'
const YANDEX_STATE_COOKIE_PATH = '/api/auth/yandex'

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(private readonly authService: AuthService) {}

  @UseGuards(AppThrottlerGuard)
  @Throttle({ default: { ...RATE_LIMITS.register, getTracker: ipTracker } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @UseGuards(AppThrottlerGuard)
  @Throttle({ default: { ...RATE_LIMITS.login, getTracker: ipAndEmailTracker } })
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

  @Get('yandex')
  yandexLogin(@Req() req: Request, @Res() res: Response) {
    const state = this.authService.generateYandexState()

    res.cookie(YANDEX_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.protocol === 'https',
      maxAge: 5 * 60 * 1000,
      path: YANDEX_STATE_COOKIE_PATH
    })

    return res.redirect(this.authService.getYandexAuthUrl(state))
  }

  @Get('yandex/callback')
  async yandexCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4011'
    const savedState = parseCookie(req.headers.cookie, YANDEX_STATE_COOKIE)
    res.clearCookie(YANDEX_STATE_COOKIE, { path: YANDEX_STATE_COOKIE_PATH })

    if (error || !code || !state || !savedState || state !== savedState) {
      return res.redirect(`${frontendUrl}/login?error=yandex_denied`)
    }

    try {
      const yandexAccessToken = await this.authService.exchangeYandexCode(code)
      const yandexUser = await this.authService.getYandexUserInfo(yandexAccessToken)
      const { accessToken } = await this.authService.findOrCreateFromYandex(yandexUser)
      return res.redirect(`${frontendUrl}/login?accessToken=${encodeURIComponent(accessToken)}`)
    } catch (err) {
      this.logger.error(`Yandex OAuth callback failed: ${(err as Error).message}`)
      return res.redirect(`${frontendUrl}/login?error=yandex_denied`)
    }
  }
}
