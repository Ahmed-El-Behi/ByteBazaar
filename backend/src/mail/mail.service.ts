import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { OrderStatus } from '../generated/prisma/enums';
import { STATUS_LABELS } from '../order/order-status';

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Paiement à la livraison',
  CARD: 'Carte bancaire',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'Virement bancaire',
};

const PAYMENT_NOTES: Record<string, string> = {
  CASH_ON_DELIVERY:
    'Vous réglerez en espèces au livreur, à la réception du colis.',
  CARD: 'Paiement accepté.',
  PAYPAL: 'Paiement accepté.',
  BANK_TRANSFER:
    'Votre commande sera expédiée à réception du virement. Les coordonnées bancaires figurent sur la page de votre commande.',
};

const money = (n: number) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} TND`;

const frontendUrl = () =>
  process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:4200';

interface ConfirmationOrder {
  id: number;
  reference: string;
  createdAt: Date;
  paymentMethod: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  items: { productName: string; quantity: number; lineTotal: number }[];
}

const STATUS_MESSAGES: Record<string, string> = {
  PENDING:
    'Votre commande a bien été enregistrée et est en attente de validation.',
  CONFIRMED: 'Votre commande a été confirmée. Nous allons bientôt la préparer.',
  PREPARING: 'Votre commande est en cours de préparation dans nos entrepôts.',
  SHIPPED:
    'Bonne nouvelle ! Votre colis a été remis au transporteur et est en route.',
  DELIVERED: 'Votre commande a été livrée avec succès.',
  CANCELLED:
    'Votre commande a été annulée. Si vous avez des questions, contactez notre support.',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Point de passage unique de tous les e-mails. Les clients fictifs (seed:demo-orders) ont des adresses
   * réalistes qui peuvent appartenir à de vraies personnes : ils ne reçoivent jamais rien.
   */
  private async send(
    options: ISendMailOptions & { to: string },
  ): Promise<boolean> {
    const recipient = await this.prisma.user.findUnique({
      where: { email: options.to },
      select: { isDemo: true },
    });
    if (recipient?.isDemo) {
      this.logger.log(`E-mail non envoyé : client fictif (${options.to})`);
      return false;
    }
    await this.mailerService.sendMail(options);
    return true;
  }

  /** Récapitulatif envoyé à la validation de la commande. Ne lève jamais d'erreur. */
  async sendOrderConfirmation(
    user: { email: string; firstName: string },
    order: ConfirmationOrder,
  ) {
    try {
      if (
        !(await this.send({
          to: user.email,
          subject: `Confirmation de votre commande ${order.reference}`,
          template: './order-confirmation',
          context: {
            firstName: user.firstName || 'Client',
            reference: order.reference,
            date: order.createdAt.toLocaleDateString('fr-FR', {
              timeZone: 'Africa/Tunis',
            }),
            items: order.items.map((i) => ({
              name: i.productName,
              quantity: i.quantity,
              lineTotal: money(i.lineTotal),
            })),
            subtotal: money(order.subtotal),
            shippingFee: money(order.shippingFee),
            total: money(order.total),
            shippingName: order.shippingName,
            shippingPhone: order.shippingPhone,
            shippingAddress: order.shippingAddress,
            paymentLabel:
              PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod,
            paymentNote: PAYMENT_NOTES[order.paymentMethod] ?? '',
            orderUrl: `${frontendUrl()}/commandes/${order.id}`,
          },
        }))
      )
        return;
      this.logger.log(
        `Confirmation envoyée pour la commande ${order.reference}`,
      );
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de la confirmation de la commande ${order.reference}`,
        error as Error,
      );
    }
  }

  /** Notification de changement de statut de commande. Ne lève jamais d'erreur. */
  async sendOrderStatusNotification(
    toEmail: string,
    firstName: string,
    orderReference: string,
    status: OrderStatus,
    orderId: number,
  ) {
    try {
      if (
        !(await this.send({
          to: toEmail,
          subject: `Mise à jour de votre commande ${orderReference}`,
          template: './order-status',
          context: {
            firstName: firstName || 'Client',
            orderReference,
            statusLabel: STATUS_LABELS[status].fr,
            statusMessage:
              STATUS_MESSAGES[status] ?? 'Votre commande a été mise à jour.',
            orderUrl: `${frontendUrl()}/commandes/${orderId}`,
          },
        }))
      )
        return;
      this.logger.log(
        `Notification de statut envoyée pour la commande ${orderReference}`,
      );
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de la notification pour la commande ${orderReference}`,
        error as Error,
      );
    }
  }

  /** Mail de bienvenue à l'inscription. Ne lève jamais d'erreur. */
  async sendWelcomeEmail(toEmail: string, firstName: string) {
    try {
      if (
        !(await this.send({
          to: toEmail,
          subject: 'Bienvenue sur ByteBazaar ! 🎉',
          template: './welcome',
          context: { firstName: firstName || 'Membre' },
        }))
      )
        return;
      this.logger.log(`Mail de bienvenue envoyé à ${toEmail}`);
    } catch (error) {
      this.logger.error(
        `Échec d'envoi du mail de bienvenue à ${toEmail}`,
        error as Error,
      );
    }
  }

  /** Lien de réinitialisation du mot de passe. Lève une erreur en cas d'échec d'envoi. */
  async sendPasswordResetEmail(
    toEmail: string,
    firstName: string,
    token: string,
  ) {
    const resetLink = `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const name = escapeHtml(firstName || 'Client');

    await this.send({
      to: toEmail,
      subject: 'Réinitialisation de votre mot de passe - ByteBazaar',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #1e293b; border-radius: 16px; background-color: #131927; color: #ffffff;">
          <h2 style="color: #ffffff; margin-top: 0;">Bonjour ${name},</h2>
          <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
            Vous avez demandé la réinitialisation de votre mot de passe pour votre compte ByteBazaar.
          </p>
          <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
            Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe (ce lien expire dans 15 minutes et ne peut servir qu'une fois) :
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="background-color: #f59e0b; color: #000000; font-weight: bold; padding: 14px 28px; border-radius: 30px; text-decoration: none; display: inline-block; font-size: 15px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.5; border-top: 1px solid #1e293b; padding-top: 16px;">
            Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
          </p>
        </div>
      `,
    });
    this.logger.log(`Lien de réinitialisation envoyé à ${toEmail}`);
  }
}
