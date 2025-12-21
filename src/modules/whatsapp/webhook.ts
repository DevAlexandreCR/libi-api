import { Request, Response } from 'express'
import { MessageRole, SessionStatus } from '@prisma/client'
import { config } from '../../config/env'
import fs from 'fs'
import path from 'path'
import {
  findLineByPhoneNumberId,
  sendWhatsAppText,
  sendWhatsAppInteractive,
  sendWhatsAppList,
  downloadWhatsAppMedia,
  sendWhatsAppImage,
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
import { checkBusinessHoursStatus } from './businessHours.service'

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
    const messageId = incoming.id // WhatsApp message ID único
    const text = sanitizeMessageBody(incoming)
    const hasImage = incoming.type === 'image'
    const imageId = hasImage ? incoming.image?.id : null

    // Verificar si este mensaje ya fue procesado (deduplicación)
    const existingMessage = await prisma.sessionMessage.findFirst({
      where: { whatsappMessageId: messageId },
    })

    if (existingMessage) {
      logger.info({ messageId, sessionId: existingMessage.sessionId }, 'Duplicate message detected, skipping')
      return res.sendStatus(200)
    }

    const line = await findLineByPhoneNumberId(phoneNumberId)
    if (!line) {
      logger.warn({ phoneNumberId }, 'Webhook for unknown phone number')
      return res.sendStatus(404)
    }

    // Check if bot is manually disabled for this line
    if (!line.botEnabled) {
      logger.info({ lineId: line.id, from }, 'Bot is manually disabled for this line')
      return res.sendStatus(200)
    }

    // Check business hours at merchant level
    const businessStatus = await checkBusinessHoursStatus(line.merchantId)
    if (!businessStatus.shouldRespond) {
      // If there's a specific message (closed hours), send it
      if (businessStatus.message) {
        await sendWhatsAppText(line.id, from, businessStatus.message)
      }
      // Don't process the message further
      return res.sendStatus(200)
    }

    const session = await findOrCreateSession(
      line.merchantId,
      line.id,
      from,
      config.SESSION_EXPIRATION_MINUTES
    )

    const isSupportSession = session.status === SessionStatus.SUPPORT

    // Check if session is in manual mode or support - if so, don't process with AI
    if (session.isManualMode || isSupportSession) {
      await appendSessionMessage(session.id, MessageRole.user, text, messageId)

      // Broadcast event to merchant to notify new message received
      const { broadcastSSE } = await import('../../utils/sse')
      broadcastSSE(line.merchantId, {
        type: 'session_message_received',
        data: {
          sessionId: session.id,
          customerPhone: from,
          message: text,
          isImage: hasImage,
          status: session.status,
        },
      })

      return res.sendStatus(200)
    }

    // Check if there's an order awaiting payment proof
    const pendingOrder = await prisma.order.findFirst({
      where: {
        sessionId: session.id,
        awaitingPaymentProof: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // If there's a pending order but user didn't send an image, remind them
    if (pendingOrder && !hasImage) {
      await appendSessionMessage(session.id, MessageRole.user, text, messageId)

      await sendWhatsAppText(
        line.id,
        from,
        'Por favor, envía una foto del comprobante de pago para que podamos verificar tu transferencia. 📸'
      )

      await appendSessionMessage(
        session.id,
        MessageRole.assistant,
        'Por favor, envía una foto del comprobante de pago para que podamos verificar tu transferencia. 📸'
      )

      return res.sendStatus(200)
    }

    // If image is sent and there's an order awaiting proof, save it
    if (hasImage && imageId && pendingOrder) {
      try {
        logger.info({ orderId: pendingOrder.id, imageId }, 'Downloading payment proof')
        const imageBuffer = await downloadWhatsAppMedia(line.id, imageId)

        // Save image to uploads/payment-proofs
        const filename = `proof-${pendingOrder.id}-${Date.now()}.jpg`
        const filepath = path.join('uploads', 'payment-proofs', filename)
        fs.writeFileSync(filepath, imageBuffer)

        // Update order with payment proof URL
        await prisma.order.update({
          where: { id: pendingOrder.id },
          data: { paymentProofUrl: filepath },
        })

        // Broadcast event to merchant
        const { broadcastSSE } = await import('../../utils/sse')
        broadcastSSE(line.merchantId, {
          type: 'payment_proof_uploaded',
          data: { orderId: pendingOrder.id, paymentProofUrl: filepath },
        })

        logger.info({ orderId: pendingOrder.id, filepath }, 'Payment proof saved')

        // Send acknowledgment message
        await sendWhatsAppText(
          line.id,
          from,
          'Gracias por enviar el comprobante. El comercio lo verificará y tu pedido será procesado.'
        )

        // Don't process this message with AI, just acknowledge
        await appendSessionMessage(session.id, MessageRole.user, '[Imagen: Comprobante de pago]', messageId)
        await appendSessionMessage(
          session.id,
          MessageRole.assistant,
          'Gracias por enviar el comprobante. El comercio lo verificará y tu pedido será procesado.'
        )

        return res.sendStatus(200)
      } catch (err) {
        logger.error({ err, orderId: pendingOrder.id }, 'Failed to download payment proof')
        // Continue with normal flow if download fails
      }
    }

    await appendSessionMessage(session.id, MessageRole.user, text, messageId)

    // Broadcast message_received event to merchant dashboard
    const { broadcastSSE } = await import('../../utils/sse')
    broadcastSSE(line.merchantId, {
      type: 'message_received',
      data: {
        sessionId: session.id,
        customerPhone: from,
        message: {
          role: 'user',
          content: text,
          createdAt: new Date().toISOString(),
        },
      },
    })

    const merchant = await prisma.merchant.findUnique({ where: { id: line.merchantId } })
    const menu = await getActiveMenu(line.merchantId).catch(() => null)
    const paymentAccounts = await prisma.paymentAccount.findMany({
      where: { merchantId: line.merchantId, isActive: true },
      select: {
        type: true,
        accountNumber: true,
        accountHolder: true,
        bankName: true,
        description: true,
      },
    })
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
      paymentAccounts: paymentAccounts.map((acc) => ({
        type: acc.type,
        accountNumber: acc.accountNumber,
        accountHolder: acc.accountHolder,
        bankName: acc.bankName ?? undefined,
        description: acc.description ?? undefined,
      })),
    })

    const sessionState = (session.state as any) || {}
    const menuImagesAlreadySent = Boolean(sessionState?.menu_images_sent)
    const wantsMenuImages =
      (aiResponse.send_menu_images || aiResponse.intent === 'GREETING') && !menuImagesAlreadySent

    let menuImages: Awaited<ReturnType<typeof prisma.upload.findMany>> = []
    if (wantsMenuImages && menu?.id) {
      menuImages = await prisma.upload.findMany({
        where: { menuId: menu.id },
        orderBy: { createdAt: 'asc' },
      })
    }
    const shouldSendMenuImages = wantsMenuImages && menuImages.length > 0
    if (wantsMenuImages && !shouldSendMenuImages) {
      logger.warn({ menuId: menu?.id }, 'Menu images requested but none found')
    }

    const newState = { ...sessionState, ...(aiResponse.session_updates || {}) }
    if (shouldSendMenuImages && menuImages.length) {
      newState.menu_images_sent = true
    }

    const newStatus =
      (aiResponse.session_updates?.status as SessionStatus | undefined) ||
      (aiResponse.intent === 'SUPPORT' ? SessionStatus.SUPPORT : undefined)
    await updateSessionState(session.id, newState, newStatus)

    let replyToSend = aiResponse.reply
    if (shouldSendMenuImages) {
      replyToSend = `Hola 👋, gracias por escribir a ${merchant?.name || 'nuestro restaurante'
        }. Te comparto nuestra carta en imágenes. ¿Qué se te antoja hoy?`
    }

    if (aiResponse.intent === 'SUPPORT' && (!replyToSend || !replyToSend.trim())) {
      replyToSend = `Tu mensaje ha sido marcado como soporte. ${merchant?.name ? `Alguien de ${merchant.name}` : 'El comercio'
        } te responderá pronto.`
    }

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
    if (replyToSend && replyToSend.trim()) {
      if (aiResponse.show_confirm_button && !orderCreated) {
        await sendWhatsAppInteractive(line.id, from, replyToSend, [
          { id: 'CONFIRM_ORDER', title: '✅ Confirmar Pedido' },
        ])
      } else if (aiResponse.interactive) {
        // Handle interactive messages (buttons or lists)
        if (aiResponse.interactive.type === 'buttons' && aiResponse.interactive.buttons) {
          await sendWhatsAppInteractive(
            line.id,
            from,
            replyToSend,
            aiResponse.interactive.buttons
          )
        } else if (aiResponse.interactive.type === 'list' && aiResponse.interactive.list) {
          await sendWhatsAppList(
            line.id,
            from,
            replyToSend,
            aiResponse.interactive.list.button_text,
            aiResponse.interactive.list.sections
          )
        } else {
          await sendWhatsAppText(line.id, from, replyToSend)
        }
      } else {
        await sendWhatsAppText(line.id, from, replyToSend)
      }
      await appendSessionMessage(session.id, MessageRole.assistant, replyToSend)
    }

    if (shouldSendMenuImages && menuImages.length) {
      for (const [idx, image] of menuImages.entries()) {
        try {
          await sendWhatsAppImage(
            line.id,
            from,
            image.filePath,
            image.mimeType || undefined,
            idx === 0 ? 'Te comparto nuestra carta 📋' : undefined
          )
        } catch (err) {
          logger.error({ err, imageId: image.id }, 'Failed to send menu image')
        }
      }
    }
    res.sendStatus(200)
  } catch (err) {
    logger.error({ err }, 'Failed to process webhook')
    res.sendStatus(500)
  }
}
