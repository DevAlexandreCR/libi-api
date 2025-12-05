import { Response } from 'express'
import { EventEmitter } from 'events'
import { logger } from './logger'

const emitter = new EventEmitter()
emitter.setMaxListeners(50)

export type SSEPayload = {
  type: string
  data: unknown
}

export function registerSSE(merchantId: string, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  })

  // Send initial connection message to activate browser's onopen event
  res.write(`event: connected\n`)
  res.write(
    `data: ${JSON.stringify({ message: 'SSE connection established', merchantId, timestamp: new Date().toISOString() })}\n\n`
  )

  const listener = (payload: SSEPayload) => {
    try {
      res.write(`event: ${payload.type}\n`)
      res.write(`data: ${JSON.stringify(payload.data)}\n\n`)
      logger.info({ merchantId, eventType: payload.type }, '[SSE] Event sent to client')
    } catch (error) {
      logger.error({ error, merchantId, eventType: payload.type }, '[SSE] Failed to send event')
    }
  }

  emitter.on(`merchant:${merchantId}`, listener)
  logger.info(
    { merchantId, listenerCount: emitter.listenerCount(`merchant:${merchantId}`) },
    '[SSE] Client connected'
  )

  res.on('close', () => {
    emitter.off(`merchant:${merchantId}`, listener)
    logger.info(
      { merchantId, listenerCount: emitter.listenerCount(`merchant:${merchantId}`) },
      '[SSE] Client disconnected'
    )
    res.end()
  })
}

export function broadcastSSE(merchantId: string, payload: SSEPayload) {
  const eventName = `merchant:${merchantId}`
  const listenerCount = emitter.listenerCount(eventName)

  logger.info(
    {
      merchantId,
      eventType: payload.type,
      listenerCount,
      hasListeners: listenerCount > 0,
    },
    '[SSE] Broadcasting event'
  )

  if (listenerCount === 0) {
    logger.warn(
      { merchantId, eventType: payload.type },
      '[SSE] No listeners connected for this merchant'
    )
  }

  emitter.emit(eventName, payload)
}
