import {
  Controller,
  Post,
  Delete,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { TelegramService } from './telegram.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard' // путь к вашему существующему guard

@Controller('telegram')
@UseGuards(JwtAuthGuard)
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  /**
   * POST /api/telegram/link-token
   * Генерирует deep link для привязки Telegram
   */
  @Post('link-token')
  async generateLinkToken(@Request() req: { user: { id: string } }) {
    return this.telegramService.generateLinkToken(req.user.id)
  }

  /**
   * DELETE /api/telegram/unlink
   * Отвязывает Telegram от аккаунта
   */
  @Delete('unlink')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(@Request() req: { user: { id: string } }) {
    return this.telegramService.unlink(req.user.id)
  }

  /**
   * GET /api/telegram/status
   * Возвращает статус привязки
   */
  @Get('status')
  async status(@Request() req: { user: { id: string } }) {
    return this.telegramService.getStatus(req.user.id)
  }
}
