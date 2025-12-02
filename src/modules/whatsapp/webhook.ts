import { Request, Response } from 'express'
import { MessageRole, SessionStatus } from '@prisma/client'
import { config } from '../../config/env'
import {
  findLineByPhoneNumberId,
  sendWhatsAppText,
  sendWhatsAppInteractive,
  sendWhatsAppList,
} from './whatsapp.service'
import {
  appendSessionMessage,
  findOrCreateSession,
  updateSessionState,
} from '../sessions/session.service'
import { getActiveMenu } from '../menus/menu.service'
import { callOrderAssistant } from '../ai/orderAssistant'
import { createOrderFromSummary } from '../orders/order.service'
import { prisma } from '../../prisma/client'
import { logger } from '../../utils/logger'

function buildMenuJson(menu: Awaited<ReturnType<typeof getActiveMenu>> | null) {
  if (!menu) return null
  return {
    menu_id: menu.id,
    name: menu.name,
    categories: menu.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      items: cat.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        base_price: Number(item.basePrice),
        image_url: item.imageUrl,
        is_available: item.isAvailable,
        option_groups: item.optionGroups.map((og) => ({
          id: og.id,
          name: og.name,
          type: og.type,
          is_required: og.isRequired,
          min: og.min,
          max: og.max,
          options: og.options.map((opt) => ({
            id: opt.id,
            name: opt.name,
            extra_price: Number(opt.extraPrice),
          })),
        })),
      })),
    })),
  }
}

function sanitizeMessageBody(body: any) {
  // Handle button responses
  if (body?.interactive?.type === 'button_reply') {
    return `BUTTON:${body.interactive.button_reply.id}`
  }
  // Handle list responses
  if (body?.interactive?.type === 'list_reply') {
    return `LIST:${body.interactive.list_reply.id}`
  }
  return body?.text?.body || body?.interactive?.text || JSON.stringify(body)
}

export function verifyWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === config.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge)
  }
  return res.sendStatus(403)
}

export async function handleWebhook(req: Request, res: Response) {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value
    const messages = entry?.messages
    const phoneNumberId = entry?.metadata?.phone_number_id

    if (!messages || !messages.length || !phoneNumberId) {
      return res.sendStatus(200)
    }

    const incoming = messages[0]
    const from = incoming.from
    const text = sanitizeMessageBody(incoming)

    const line = await findLineByPhoneNumberId(phoneNumberId)
    if (!line) {
      logger.warn({ phoneNumberId }, 'Webhook for unknown phone number')
      return res.sendStatus(404)
    }

    const session = await findOrCreateSession(
      line.merchantId,
      line.id,
      from,
      config.SESSION_EXPIRATION_MINUTES
    )
    await appendSessionMessage(session.id, MessageRole.user, text)

    const merchant = await prisma.merchant.findUnique({ where: { id: line.merchantId } })
    const menu = await getActiveMenu(line.merchantId).catch(() => null)
    const history = await prisma.sessionMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 12,
    })

    const aiResponse = await callOrderAssistant({
      restaurantInfo: {
        name: merchant?.name,
        address: merchant?.address,
        phone: merchant?.phone,
        timezone: merchant?.timezone,
      },
      menu: buildMenuJson(menu),
      sessionState: (session.state as any) || {},
      lastUserMessage: text,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    })

    const newState = { ...(session.state as any), ...(aiResponse.session_updates || {}) }
    const newStatus = aiResponse.session_updates?.status as SessionStatus | undefined
    await updateSessionState(session.id, newState, newStatus)
    await appendSessionMessage(session.id, MessageRole.assistant, aiResponse.reply)

    // Prevent duplicate order creation
    let orderCreated = false
    if (aiResponse.order_summary?.should_create_order) {
      // Check if an order already exists for this session
      const existingOrder = await prisma.order.findFirst({
        where: { sessionId: session.id },
      })

      if (!existingOrder) {
        await createOrderFromSummary(
          line.merchantId,
          session.id,
          aiResponse.order_summary.order as any
        )
        orderCreated = true
        logger.info({ sessionId: session.id }, 'Order created successfully')
      } else {
        logger.warn(
          { sessionId: session.id, orderId: existingOrder.id },
          'Order already exists for this session, skipping creation'
        )
      }
    }

    // Send message with or without confirmation button
    // Don't send message if reply is empty (courtesy messages after confirmation)
    if (aiResponse.reply && aiResponse.reply.trim()) {
      if (aiResponse.show_confirm_button && !orderCreated) {
        await sendWhatsAppInteractive(line.id, from, aiResponse.reply, [
          { id: 'CONFIRM_ORDER', title: '✅ Confirmar Pedido' },
        ])
      } else if (aiResponse.interactive) {
        // Handle interactive messages (buttons or lists)
        if (aiResponse.interactive.type === 'buttons' && aiResponse.interactive.buttons) {
          await sendWhatsAppInteractive(
            line.id,
            from,
            aiResponse.reply,
            aiResponse.interactive.buttons
          )
        } else if (aiResponse.interactive.type === 'list' && aiResponse.interactive.list) {
          await sendWhatsAppList(
            line.id,
            from,
            aiResponse.reply,
            aiResponse.interactive.list.button_text,
            aiResponse.interactive.list.sections
          )
        } else {
          await sendWhatsAppText(line.id, from, aiResponse.reply)
        }
      } else {
        await sendWhatsAppText(line.id, from, aiResponse.reply)
      }
    }
    res.sendStatus(200)
  } catch (err) {
    logger.error({ err }, 'Failed to process webhook')
    res.sendStatus(500)
  }
}
