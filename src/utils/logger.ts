import pino from 'pino'
import { config } from '../config/env'

const isDev = config.NODE_ENV !== 'production'

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
})
