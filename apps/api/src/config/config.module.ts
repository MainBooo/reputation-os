import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import appConfig from './app.config'
import databaseConfig from './database.config'
import jwtConfig from './jwt.config'
import redisConfig from './redis.config'
import { envValidation } from './env.validation'

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig],
      validate: envValidation
    })
  ]
})
export class ConfigModule {}
