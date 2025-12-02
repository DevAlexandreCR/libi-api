import axios from 'axios'
import { Prisma, WhatsAppLineStatus } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { badRequest, notFound } from '../../utils/errors'
import { config } from '../../config/env'
import { logger } from '../../utils/logger'

export type WhatsAppLinePayload = {
  waba_id?: string
  phone_number_id?: string
  access_token?: string
  business_id?: string
  phone_number?: string
  phone_display_name?: string
}

export async function listWhatsAppLines(merchantId: string) {
  return prisma.whatsAppLine.findMany({ where: { merchantId } })
}

export async function createWhatsAppLine(merchantId: string, data?: Partial<WhatsAppLinePayload>) {
  const payload: Prisma.WhatsAppLineCreateInput = {
    merchant: { connect: { id: merchantId } },
    wabaId: data?.waba_id,
    phoneNumberId: data?.phone_number_id,
    phoneNumber: data?.phone_number,
    phoneDisplayName: data?.phone_display_name,
    metaBusinessId: data?.business_id,
    metaAccessToken: data?.access_token,
    status: WhatsAppLineStatus.PENDING_CONFIG,
  }
  return prisma.whatsAppLine.create({ data: payload })
}

export async function completeEmbeddedSignup(merchantId: string, payload: WhatsAppLinePayload) {
  if (!payload.phone_number_id || !payload.access_token || !payload.waba_id) {
    throw badRequest('Missing WhatsApp account data')
  }

  const existing = await prisma.whatsAppLine.findFirst({
    where: {
      merchantId,
      OR: [{ phoneNumberId: payload.phone_number_id }, { wabaId: payload.waba_id }],
    },
  })

  if (existing) {
    return prisma.whatsAppLine.update({
      where: { id: existing.id },
      data: {
        phoneNumberId: payload.phone_number_id,
        metaAccessToken: payload.access_token,
        wabaId: payload.waba_id,
        metaBusinessId: payload.business_id,
        phoneNumber: payload.phone_number,
        phoneDisplayName: payload.phone_display_name,
        status: WhatsAppLineStatus.ACTIVE,
      },
    })
  }

  return prisma.whatsAppLine.create({
    data: {
      merchant: { connect: { id: merchantId } },
      phoneNumberId: payload.phone_number_id,
      metaAccessToken: payload.access_token,
      wabaId: payload.waba_id,
      metaBusinessId: payload.business_id,
      phoneNumber: payload.phone_number,
      phoneDisplayName: payload.phone_display_name,
      status: WhatsAppLineStatus.ACTIVE,
    },
  })
}

export async function updateWhatsAppLine(id: string, data: Prisma.WhatsAppLineUpdateInput) {
  const existing = await prisma.whatsAppLine.findUnique({ where: { id } })
  if (!existing) throw notFound('WhatsApp line not found')
  return prisma.whatsAppLine.update({ where: { id }, data })
}

export async function findLineByPhoneNumberId(phoneNumberId: string) {
  return prisma.whatsAppLine.findUnique({ where: { phoneNumberId } })
}

export async function sendWhatsAppText(lineId: string, to: string, message: string) {
  const line = await prisma.whatsAppLine.findUnique({ where: { id: lineId } })
  if (!line || !line.metaAccessToken || !line.phoneNumberId) {
    throw badRequest('WhatsApp line is not configured')
  }

  const url = `${config.META_GRAPH_API_BASE}/${config.META_GRAPH_API_VERSION}/${line.phoneNumberId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message },
  }

  const headers = { Authorization: `Bearer ${line.metaAccessToken}` }
  await axios.post(url, payload, { headers })
  logger.info({ to }, 'Sent WhatsApp message')
}

export async function sendWhatsAppInteractive(
  lineId: string,
  to: string,
  message: string,
  buttons: { id: string; title: string }[]
) {
  const line = await prisma.whatsAppLine.findUnique({ where: { id: lineId } })
  if (!line || !line.metaAccessToken || !line.phoneNumberId) {
    throw badRequest('WhatsApp line is not configured')
  }

  const url = `${config.META_GRAPH_API_BASE}/${config.META_GRAPH_API_VERSION}/${line.phoneNumberId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: message },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      },
    },
  }

  const headers = { Authorization: `Bearer ${line.metaAccessToken}` }
  await axios.post(url, payload, { headers })
  logger.info({ to, buttons }, 'Sent WhatsApp interactive message')
}

export async function sendWhatsAppList(
  lineId: string,
  to: string,
  message: string,
  buttonText: string,
  sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[]
) {
  const line = await prisma.whatsAppLine.findUnique({ where: { id: lineId } })
  if (!line || !line.metaAccessToken || !line.phoneNumberId) {
    throw badRequest('WhatsApp line is not configured')
  }

  const url = `${config.META_GRAPH_API_BASE}/${config.META_GRAPH_API_VERSION}/${line.phoneNumberId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: message },
      action: {
        button: buttonText,
        sections: sections,
      },
    },
  }

  const headers = { Authorization: `Bearer ${line.metaAccessToken}` }
  await axios.post(url, payload, { headers })
  logger.info({ to, sections }, 'Sent WhatsApp list message')
}

export async function downloadWhatsAppMedia(lineId: string, mediaId: string): Promise<Buffer> {
  const line = await prisma.whatsAppLine.findUnique({ where: { id: lineId } })
  if (!line || !line.metaAccessToken) {
    throw badRequest('WhatsApp line is not configured')
  }

  const headers = { Authorization: `Bearer ${line.metaAccessToken}` }

  // Get media URL
  const mediaUrl = `${config.META_GRAPH_API_BASE}/${config.META_GRAPH_API_VERSION}/${mediaId}`
  const mediaInfoResponse = await axios.get(mediaUrl, { headers })
  const downloadUrl = mediaInfoResponse.data.url

  // Download media file
  const fileResponse = await axios.get(downloadUrl, {
    headers,
    responseType: 'arraybuffer',
  })

  logger.info({ mediaId }, 'Downloaded WhatsApp media')
  return Buffer.from(fileResponse.data)
}
