import fs from 'fs'
import path from 'path'
import { callOpenAI, ChatMessage } from './openaiClient'
import { logger } from '../../utils/logger'

const defaultPrompt = fs.readFileSync(
  path.join(__dirname, 'prompts', 'orderAssistantPrompt.md'),
  'utf-8'
)

const systemPrompt = defaultPrompt

export type OrderAssistantContext = {
  restaurantInfo: Record<string, unknown>
  menu: Record<string, unknown> | null
  sessionState: Record<string, unknown>
  lastUserMessage: string
  history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
  paymentAccounts?: Array<{
    type: string
    accountNumber: string
    accountHolder: string
    bankName?: string
    description?: string
  }>
}

export type OrderAssistantResponse = {
  reply: string
  session_updates: Record<string, unknown>
  order_summary: {
    should_create_order: boolean
    order: Record<string, unknown>
  }
  show_confirm_button?: boolean
  interactive?: {
    type: 'buttons' | 'list'
    buttons?: { id: string; title: string }[]
    list?: {
      button_text: string
      sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[]
    }
  }
}

function sanitizeJson(content: string): string {
  const cleaned = content.trim()
  if (cleaned.startsWith('```')) {
    return cleaned
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim()
  }
  return cleaned
}

export async function callOrderAssistant(
  context: OrderAssistantContext
): Promise<OrderAssistantResponse> {
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }]

  if (context.history?.length) {
    context.history.forEach((msg) => messages.push({ role: msg.role, content: msg.content }))
  }

  const userContent =
    `restaurant_info: ${JSON.stringify(context.restaurantInfo)}\n` +
    `menu: ${JSON.stringify(context.menu ?? {})}\n` +
    `session_state: ${JSON.stringify(context.sessionState)}\n` +
    `payment_accounts: ${JSON.stringify(context.paymentAccounts ?? [])}\n` +
    `last_message: ${context.lastUserMessage}`

  messages.push({ role: 'user', content: userContent })

  const response = await callOpenAI(messages, 'json_object')
  try {
    const parsed: OrderAssistantResponse = JSON.parse(sanitizeJson(response))
    return parsed
  } catch (err) {
    logger.error({ err, response }, 'Failed to parse OpenAI order assistant response')
    return {
      reply: 'Lo siento, hubo un problema procesando tu mensaje. ¿Puedes intentar nuevamente?',
      session_updates: context.sessionState,
      order_summary: { should_create_order: false, order: {} },
    }
  }
}
