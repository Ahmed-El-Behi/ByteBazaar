import {
  assertTransition,
  customerCanCancel,
  initialPaymentStatus,
  paymentStatusAfterCancel,
} from './order-status';

describe('assertTransition', () => {
  it('lets an order move forward, skipping steps if needed', () => {
    expect(() => assertTransition('PENDING', 'CONFIRMED')).not.toThrow();
    expect(() => assertTransition('CONFIRMED', 'SHIPPED')).not.toThrow();
    expect(() => assertTransition('PREPARING', 'DELIVERED')).not.toThrow();
  });

  it('refuses to go back', () => {
    expect(() => assertTransition('SHIPPED', 'PREPARING')).toThrow();
    expect(() => assertTransition('CONFIRMED', 'PENDING')).toThrow();
  });

  it('allows cancelling any order that is not final', () => {
    expect(() => assertTransition('SHIPPED', 'CANCELLED')).not.toThrow();
  });

  it('locks delivered and cancelled orders', () => {
    expect(() => assertTransition('DELIVERED', 'CANCELLED')).toThrow();
    expect(() => assertTransition('CANCELLED', 'CONFIRMED')).toThrow();
  });

  it('accepts a status that does not change', () => {
    expect(() => assertTransition('DELIVERED', 'DELIVERED')).not.toThrow();
  });
});

describe('customerCanCancel', () => {
  it('allows cancelling until preparation starts', () => {
    expect(customerCanCancel('PENDING')).toBe(true);
    expect(customerCanCancel('CONFIRMED')).toBe(true);
    expect(customerCanCancel('PREPARING')).toBe(false);
    expect(customerCanCancel('SHIPPED')).toBe(false);
    expect(customerCanCancel('CANCELLED')).toBe(false);
  });
});

describe('payment status', () => {
  it('marks online payments as paid at checkout', () => {
    expect(initialPaymentStatus('CARD')).toBe('PAID');
    expect(initialPaymentStatus('PAYPAL')).toBe('PAID');
    expect(initialPaymentStatus('BANK_TRANSFER')).toBe('PENDING');
    expect(initialPaymentStatus('CASH_ON_DELIVERY')).toBe('PENDING');
  });

  it('refunds a paid order when it is cancelled', () => {
    expect(paymentStatusAfterCancel('PAID')).toBe('REFUNDED');
    expect(paymentStatusAfterCancel('PENDING')).toBe('PENDING');
  });
});
