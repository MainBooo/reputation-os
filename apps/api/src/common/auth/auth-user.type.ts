import { SystemRole } from '@prisma/client'

export interface AuthUser { id: string; email?: string; systemRole?: SystemRole }
