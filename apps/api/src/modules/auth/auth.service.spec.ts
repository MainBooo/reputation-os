import { Test } from '@nestjs/testing'
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import * as bcrypt from 'bcrypt'

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  workspaceMember: {
    create: jest.fn(),
  },
}

const mockJwt = {
  sign: jest.fn().mockReturnValue('signed-token'),
}

describe('AuthService', () => {
  let service: AuthService

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile()
    service = module.get(AuthService)
  })

  describe('register', () => {
    const dto = { email: 'user@test.com', password: 'pass123', fullName: 'Test User' }

    it('returns accessToken on successful registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({ id: 'uid1', email: dto.email })
      mockPrisma.workspace.findUnique.mockResolvedValue(null)
      mockPrisma.workspace.create.mockResolvedValue({ id: 'wid1', slug: 'test-user' })
      mockPrisma.workspaceMember.create.mockResolvedValue({})

      const result = await service.register(dto)

      expect(result.accessToken).toBe('signed-token')
      expect(result.user.email).toBe(dto.email)
    })

    it('throws BadRequestException on duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' })

      await expect(service.register(dto)).rejects.toThrow(BadRequestException)
    })

    it('creates a workspace and OWNER membership', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({ id: 'uid1', email: dto.email })
      mockPrisma.workspace.findUnique.mockResolvedValue(null)
      mockPrisma.workspace.create.mockResolvedValue({ id: 'wid1', slug: 'test-user' })
      mockPrisma.workspaceMember.create.mockResolvedValue({})

      await service.register(dto)

      expect(mockPrisma.workspace.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.workspaceMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'OWNER' }) })
      )
    })
  })

  describe('login', () => {
    const dto = { email: 'user@test.com', password: 'pass123' }

    it('returns accessToken on valid credentials', async () => {
      const hash = await bcrypt.hash(dto.password, 10)
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid1', email: dto.email, passwordHash: hash })
      mockPrisma.user.update.mockResolvedValue({})

      const result = await service.login(dto)

      expect(result.accessToken).toBe('signed-token')
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastLoginAt: expect.any(Date) }) })
      )
    })

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException)
    })

    it('throws UnauthorizedException on wrong password', async () => {
      const hash = await bcrypt.hash('other-password', 10)
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uid1', email: dto.email, passwordHash: hash })

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException)
    })
  })
})
