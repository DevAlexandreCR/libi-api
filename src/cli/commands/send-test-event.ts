import { Command } from 'commander'

interface CommandOptions {
  merchantId: string
  event: string
  orderId?: string
  status: string
  secret?: string
}

async function sendEventToBackend(
  merchantId: string,
  eventType: string,
  data: unknown,
  secret?: string
) {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001'
  const url = `${baseUrl}/api/merchants/${merchantId}/trigger-event`

  // Get secret from env if not provided
  const sseSecret = secret || process.env.SSE_TRIGGER_SECRET || 'dev-secret-change-in-production'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sse-secret': sseSecret,
    },
    body: JSON.stringify({
      event: eventType,
      data,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`HTTP ${response.status}: ${error}`)
  }

  return response.json()
}

export const sendTestEventCommand = new Command('sse:test')
  .description('Enviar eventos SSE de prueba al frontend')
  .requiredOption('-m, --merchant-id <merchantId>', 'ID del merchant')
  .requiredOption(
    '-e, --event <eventType>',
    'Tipo de evento (order_created, order_updated, payment_verified, payment_proof_uploaded)'
  )
  .option('-o, --order-id <orderId>', 'ID del pedido (por defecto: test-order-{timestamp})')
  .option(
    '-s, --status <status>',
    'Estado del pedido para order_updated (PENDING, IN_PREPARATION, READY, DELIVERING, DELIVERED, CANCELLED)',
    'PENDING'
  )
  .option(
    '-S, --secret <secret>',
    'Secret para triggear eventos SSE (o usar SSE_TRIGGER_SECRET env var)'
  )
  .action(async (options: CommandOptions) => {
    const { merchantId, event, orderId, status, secret } = options
    const testOrderId = orderId || `test-order-${Date.now()}`
    const timestamp = new Date().toISOString()

    console.log('📡 Enviando evento SSE de prueba...')
    console.log('Merchant ID:', merchantId)
    console.log('Evento:', event)
    console.log('')

    try {
      let eventData: unknown

      switch (event) {
        case 'order_created':
          eventData = {
            id: testOrderId,
            merchantId,
            sessionId: `test-session-${Date.now()}`,
            status: 'PENDING',
            deliveryType: 'delivery',
            address: 'Calle 123 #45-67, Bogotá',
            paymentMethod: 'transfer',
            notes: 'Sin cebolla, por favor (Test)',
            estimatedTotal: 35000,
            paymentProofUrl: null,
            paymentVerified: false,
            awaitingPaymentProof: true,
            items: [
              {
                id: `item-1-${Date.now()}`,
                orderId: testOrderId,
                menuItemId: 'test-menu-item-1',
                name: 'Hamburguesa Clásica',
                quantity: 2,
                unitPrice: 15000,
                subtotal: 30000,
                options: [
                  {
                    id: `option-1-${Date.now()}`,
                    orderItemId: `item-1-${Date.now()}`,
                    menuItemOptionId: 'test-option-1',
                    name: 'Extra queso',
                    extraPrice: 2500,
                  },
                ],
              },
              {
                id: `item-2-${Date.now()}`,
                orderId: testOrderId,
                menuItemId: 'test-menu-item-2',
                name: 'Papas Fritas',
                quantity: 1,
                unitPrice: 5000,
                subtotal: 5000,
                options: [],
              },
            ],
            createdAt: timestamp,
            updatedAt: timestamp,
          }
          break

        case 'order_updated':
          eventData = {
            id: testOrderId,
            merchantId,
            sessionId: `test-session-${Date.now()}`,
            status,
            deliveryType: 'delivery',
            address: 'Calle 123 #45-67, Bogotá',
            paymentMethod: 'cash',
            notes: 'Sin cebolla, por favor (Test)',
            estimatedTotal: 35000,
            paymentProofUrl: null,
            paymentVerified: true,
            awaitingPaymentProof: false,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
          break

        case 'payment_verified':
          eventData = {
            id: testOrderId,
            merchantId,
            sessionId: `test-session-${Date.now()}`,
            status: 'IN_PREPARATION',
            deliveryType: 'delivery',
            address: 'Calle 123 #45-67, Bogotá',
            paymentMethod: 'transfer',
            notes: 'Sin cebolla, por favor (Test)',
            estimatedTotal: 35000,
            paymentProofUrl: `uploads/payment-proofs/proof-${testOrderId}-${Date.now()}.jpg`,
            paymentVerified: true,
            awaitingPaymentProof: false,
            items: [
              {
                id: `item-1-${Date.now()}`,
                orderId: testOrderId,
                menuItemId: 'test-menu-item-1',
                name: 'Hamburguesa Clásica',
                quantity: 2,
                unitPrice: 15000,
                subtotal: 30000,
                options: [
                  {
                    id: `option-1-${Date.now()}`,
                    orderItemId: `item-1-${Date.now()}`,
                    menuItemOptionId: 'test-option-1',
                    name: 'Extra queso',
                    extraPrice: 2500,
                  },
                ],
              },
            ],
            createdAt: timestamp,
            updatedAt: timestamp,
            session: {
              id: `test-session-${Date.now()}`,
              customerPhone: '+573001234567',
              merchant: {
                id: merchantId,
                name: 'Restaurante Test',
              },
            },
          }
          break

        case 'payment_proof_uploaded':
          eventData = {
            orderId: testOrderId,
            paymentProofUrl: `uploads/payment-proofs/proof-${testOrderId}-${Date.now()}.jpg`,
          }
          break

        default:
          console.error('❌ Evento no válido')
          console.log('Eventos disponibles:')
          console.log('  - order_created')
          console.log('  - order_updated')
          console.log('  - payment_verified')
          console.log('  - payment_proof_uploaded')
          process.exit(1)
      }

      await sendEventToBackend(merchantId, event, eventData, secret)

      console.log(`✅ Evento "${event}" enviado correctamente`)
      if (event === 'order_created' || event === 'order_updated') {
        console.log('Order ID:', testOrderId)
      }
      if (event === 'order_updated') {
        console.log('Estado:', status)
      }
      console.log('')
      console.log('✨ Evento enviado exitosamente a todos los clientes SSE conectados')
      process.exit(0)
    } catch (error) {
      console.error('❌ Error al enviar evento:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })
