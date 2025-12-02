import { DeliveryType, OrderStatus, Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { broadcastSSE } from '../../utils/sse'
import { notFound } from '../../utils/errors'

export type OrderSummaryInput = {
  items: Array<{
    item_id?: string
    name: string
    quantity: number
    unit_price: number
    subtotal: number
    modifiers?: {
      options?: Array<{ option_id?: string; name: string; extra_price: number }>
    }
  }>
  delivery_type: 'delivery' | 'pickup' | null
  address?: string | null
  payment_method?: string | null
  notes?: string | null
  estimated_total: number
}

export async function createOrderFromSummary(
  merchantId: string,
  sessionId: string,
  summary: OrderSummaryInput
) {
  const paymentMethod = summary.payment_method?.toLowerCase() || ''
  const isTransferPayment = paymentMethod.includes('transferencia') || 
                            paymentMethod.includes('transfer')

  const order = await prisma.order.create({
    data: {
      merchantId,
      sessionId,
      deliveryType: (summary.delivery_type || 'delivery') as DeliveryType,
      address: summary.address ?? null,
      paymentMethod: summary.payment_method ?? null,
      notes: summary.notes ?? null,
      estimatedTotal: new Prisma.Decimal(summary.estimated_total || 0),
      awaitingPaymentProof: isTransferPayment,
      paymentVerified: !isTransferPayment,
      items: {
        create: summary.items.map((item) => ({
          menuItemId: item.item_id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unit_price || 0),
          subtotal: new Prisma.Decimal(item.subtotal || 0),
          options: {
            create: item.modifiers?.options?.map((opt) => ({
              menuItemOptionId: opt.option_id,
              name: opt.name,
              extraPrice: new Prisma.Decimal(opt.extra_price || 0),
            })),
          },
        })),
      },
    },
    include: { items: { include: { options: true } } },
  })

  broadcastSSE(merchantId, { type: 'order_created', data: order })
  return order
}

export async function listOrders(
  merchantId: string,
  filters: { status?: OrderStatus; from?: Date; to?: Date; phone?: string }
) {
  return prisma.order.findMany({
    where: {
      merchantId,
      status: filters.status,
      createdAt: {
        gte: filters.from,
        lte: filters.to,
      },
      session: filters.phone
        ? {
            customerPhone: { contains: filters.phone },
          }
        : undefined,
    },
    include: {
      items: { include: { options: true } },
      session: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOrderById(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { options: true } },
      session: { include: { merchant: true } },
    },
  })
  if (!order) throw notFound('Order not found')
  return order
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const order = await getOrderById(id)
  const updated = await prisma.order.update({ where: { id }, data: { status } })
  broadcastSSE(order.session.merchantId, { type: 'order_updated', data: updated })
  return updated
}

export async function verifyPayment(orderId: string, verified: boolean) {
  const order = await getOrderById(orderId)
  
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentVerified: verified,
      awaitingPaymentProof: false,
      status: verified ? OrderStatus.IN_PREPARATION : order.status,
    },
    include: {
      items: { include: { options: true } },
      session: { include: { merchant: true } },
    },
  })

  broadcastSSE(order.session.merchantId, { 
    type: 'payment_verified', 
    data: updated 
  })

  return updated
}
