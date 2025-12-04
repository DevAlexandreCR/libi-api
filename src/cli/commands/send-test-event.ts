import { Command } from 'commander'
import { broadcastSSE } from '../../utils/sse'

interface CommandOptions {
  merchantId: string
  event: string
  orderId?: string
  status: string
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
  .action(async (options: CommandOptions) => {
    const { merchantId, event, orderId, status } = options
    const testOrderId = orderId || `test-order-${Date.now()}`
    const timestamp = new Date().toISOString()

    console.log('📡 Enviando evento SSE de prueba...')
    console.log('Merchant ID:', merchantId)
    console.log('Evento:', event)
    console.log('')

    try {
      switch (event) {
        case 'order_created':
          broadcastSSE(merchantId, {
            type: 'order_created',
            data: {
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
            },
          })
          console.log('✅ Evento "order_created" enviado correctamente')
          console.log('Order ID:', testOrderId)
          break

        case 'order_updated':
          broadcastSSE(merchantId, {
            type: 'order_updated',
            data: {
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
            },
          })
          console.log(`✅ Evento "order_updated" enviado con estado: ${status}`)
          break

        case 'payment_verified':
          broadcastSSE(merchantId, {
            type: 'payment_verified',
            data: {
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
            },
          })
          console.log('✅ Evento "payment_verified" enviado correctamente')
          console.log('💰 Pago verificado, pedido en preparación')
          break

        case 'payment_proof_uploaded':
          broadcastSSE(merchantId, {
            type: 'payment_proof_uploaded',
            data: {
              orderId: testOrderId,
              paymentProofUrl: `uploads/payment-proofs/proof-${testOrderId}-${Date.now()}.jpg`,
            },
          })
          console.log('✅ Evento "payment_proof_uploaded" enviado correctamente')
          console.log('📸 Comprobante de pago subido')
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

      console.log('')
      console.log('✨ Evento enviado exitosamente a todos los clientes conectados')
      process.exit(0)
    } catch (error) {
      console.error('❌ Error al enviar evento:', error)
      process.exit(1)
    }
  })
