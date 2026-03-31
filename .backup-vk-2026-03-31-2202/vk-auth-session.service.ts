import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import * as fs from 'fs'

@Injectable()
export class VkAuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSession(workspaceId: string) {
    return this.prisma.vkAuthSession.findFirst({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })
  }

  async getStorageStatePath(workspaceId: string): Promise<string | null> {
    const session = await this.getActiveSession(workspaceId)

    if (!session) return null

    if (!fs.existsSync(session.storageStatePath)) {
      await this.prisma.vkAuthSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      })
      return null
    }

    return session.storageStatePath
  }
}
