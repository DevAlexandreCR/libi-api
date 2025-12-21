import { PrismaClient } from '@prisma/client'
import { config } from '../config/env'
import { logger } from '../utils/logger'

const prismaClientSingleton = () =>
  new PrismaClient({
    log: config.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'info', 'warn', 'error']
  })

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (config.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}

// Log Prisma errors
if (config.NODE_ENV !== 'production') {
  // @ts-ignore - Prisma error event type
  prisma.$on('error', (event: any) => {
    logger.error({ event }, 'Prisma error')
  })
}
