import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

// Doit couvrir toutes les valeurs de l'enum OrderStatus (schema.prisma)
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

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

  constructor(private readonly mailerService: MailerService) {}

  /** Notification de changement de statut de commande. Ne lève jamais d'erreur. */
  async sendOrderStatusNotification(
    toEmail: string,
    firstName: string,
    orderReference: string,
    status: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to: toEmail,
        subject: `Mise à jour de votre commande ${orderReference}`,
        template: './order-status',
        context: {
          firstName: firstName || 'Client',
          orderReference,
          statusLabel: STATUS_LABELS[status] ?? status,
          statusMessage:
            STATUS_MESSAGES[status] ?? 'Votre commande a été mise à jour.',
        },
      });
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
      await this.mailerService.sendMail({
        to: toEmail,
        subject: 'Bienvenue sur ByteBazaar ! 🎉',
        template: './welcome',
        context: { firstName: firstName || 'Membre' },
      });
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const name = escapeHtml(firstName || 'Client');

    await this.mailerService.sendMail({
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
