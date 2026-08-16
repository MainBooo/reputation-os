import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { ChatGateway } from './chat.gateway'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { requireJwtSecret } from '../../common/config/require-jwt-secret'

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: requireJwtSecret()
    })
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway]
})
export class ChatModule {}
