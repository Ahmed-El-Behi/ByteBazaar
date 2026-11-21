import type { MailerService } from '@nestjs-modules/mailer';
import type { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';

// Les clients fictifs (seed:demo-orders) ont des adresses réalistes qui peuvent appartenir à de vraies
// personnes : aucun e-mail ne doit leur partir.
function setup(isDemo: boolean | null) {
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const findUnique = jest
    .fn()
    .mockResolvedValue(isDemo === null ? null : { isDemo });
  const service = new MailService(
    { sendMail } as unknown as MailerService,
    { user: { findUnique } } as unknown as PrismaService,
  );
  return { service, sendMail };
}

const order = {
  id: 1,
  reference: 'BB-000001-001',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  paymentMethod: 'CARD',
  subtotal: 100,
  shippingFee: 7,
  total: 107,
  shippingName: 'Client',
  shippingPhone: '20 000 000',
  shippingAddress: 'Tunis',
  items: [],
};

describe('MailService et clients fictifs', () => {
  it('n’écrit jamais à un client fictif', async () => {
    const { service, sendMail } = setup(true);
    await service.sendOrderConfirmation(
      { email: 'x@gmail.com', firstName: 'X' },
      order,
    );
    await service.sendOrderStatusNotification(
      'x@gmail.com',
      'X',
      'BB-000001-001',
      'SHIPPED',
      1,
    );
    await service.sendWelcomeEmail('x@gmail.com', 'X');
    await service.sendPasswordResetEmail('x@gmail.com', 'X', 'jeton');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('écrit normalement aux vrais clients', async () => {
    const { service, sendMail } = setup(false);
    await service.sendOrderStatusNotification(
      'client@exemple.tn',
      'Client',
      'BB-000001-001',
      'SHIPPED',
      1,
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: 'client@exemple.tn',
    });
  });

  it('écrit aussi à une adresse sans compte (aucun indicateur à lire)', async () => {
    const { service, sendMail } = setup(null);
    await service.sendWelcomeEmail('nouveau@exemple.tn', 'Nouveau');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
