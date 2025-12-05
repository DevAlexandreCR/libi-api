import { Request, Response } from 'express'
import { broadcastSSE } from '../../utils/sse'
import { config } from '../../config/env'

export async function triggerTestEvent(req: Request, res: Response) {
  const { merchantId } = req.params
  const { event, data } = req.body
  const secret = req.headers['x-sse-secret'] || req.query.secret

  // Validate secret
  if (secret !== config.SSE_TRIGGER_SECRET) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid SSE trigger secret',
    })
  }

  broadcastSSE(merchantId, {
    type: event,
    data,
  })

  res.json({
    success: true,
    message: `Event ${event} broadcasted to merchant ${merchantId}`,
  })
}
