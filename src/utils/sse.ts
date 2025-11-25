import { Response } from 'express';
import { EventEmitter } from 'events';

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export type SSEPayload = {
  type: string;
  data: unknown;
};

export function registerSSE(merchantId: string, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const listener = (payload: SSEPayload) => {
    res.write(`event: ${payload.type}\n`);
    res.write(`data: ${JSON.stringify(payload.data)}\n\n`);
  };

  emitter.on(`merchant:${merchantId}`, listener);

  res.on('close', () => {
    emitter.off(`merchant:${merchantId}`, listener);
    res.end();
  });
}

export function broadcastSSE(merchantId: string, payload: SSEPayload) {
  emitter.emit(`merchant:${merchantId}`, payload);
}
