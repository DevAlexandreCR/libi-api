import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrderFromSummary } from '../src/modules/orders/order.service';

vi.mock('../src/utils/sse', () => ({ broadcastSSE: vi.fn() }));

const createMock = vi.fn();

vi.mock('../src/prisma/client', () => ({
  prisma: {
    order: {
      create: createMock
    }
  }
}));

describe('createOrderFromSummary', () => {
  beforeEach(() => {
    createMock.mockResolvedValue({ id: 'order-1', items: [] });
  });

  it('maps model output into an order payload', async () => {
    const summary = {
      items: [
        {
          item_id: 'item-1',
          name: 'Burger',
          quantity: 2,
          unit_price: 10000,
          subtotal: 20000,
          modifiers: {
            options: [{ option_id: 'opt-1', name: 'Cheese', extra_price: 2000 }]
          }
        }
      ],
      delivery_type: 'delivery',
      address: 'Calle 123',
      payment_method: 'cash',
      notes: 'sin cebolla',
      estimated_total: 22000
    };

    await createOrderFromSummary('m1', 's1', summary as any);

    expect(createMock).toHaveBeenCalled();
    const call = createMock.mock.calls[0][0];
    expect(call.data.merchantId).toBe('m1');
    expect(call.data.sessionId).toBe('s1');
    expect(call.data.items.create[0].name).toBe('Burger');
    expect(call.data.items.create[0].options.create[0].name).toBe('Cheese');
  });
});
