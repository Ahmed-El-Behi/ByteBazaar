import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours de traitement',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

const STATUS_MESSAGES: Record<string, string> = {
  PENDING: 'Votre commande a bien été enregistrée et est en attente de validation.',
  PROCESSING: 'Votre commande est en cours de préparation dans nos entrepôts.',
  SHIPPED: 'Bonne nouvelle ! Votre colis a été remis au transporteur et est en route.',
  DELIVERED: 'Votre commande a été livrée avec succès.',
  CANCELLED: 'Votre commande a été annulée. Si vous avez des questions, contactez notre support.',
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Envoi de notification de changement de statut de commande
   */
  async sendOrderStatusNotification(
    toEmail: string,
    firstName: string,
    orderId: number | string,
    orderReference: string,
    status: string,
  ): Promise<void> {
    try {
      this.logger.log(`[Mail] Envoi de notification de commande à : ${toEmail}`);

      const formattedReference = orderReference || `#${orderId}`;
      const readableStatus = STATUS_LABELS[status] || status;
      const message = STATUS_MESSAGES[status] || 'Votre commande a été mise à jour.';

      await this.mailerService.sendMail({
        to: toEmail,
        subject: `Mise à jour de votre commande ${formattedReference}`,
        template: './order-status',
        context: {
          firstName: firstName || 'Client',
          orderId,
          orderReference: formattedReference,
          status,
          statusLabel: readableStatus,
          statusMessage: message,
        },
      });

      this.logger.log(`[Mail] Notification envoyée avec succès pour la commande ${formattedReference}`);
    } catch (error) {
      this.logger.error(`[Mail] Échec d'envoi de notification pour la commande #${orderId}`, error);
    }
  }

  /**
   * Envoi du mail de bienvenue lors de l'inscription
   */
  async sendWelcomeEmail(toEmail: string, firstName: string): Promise<void> {
    try {
      this.logger.log(`[Mail] Envoi du mail de bienvenue à : ${toEmail}`);

      await this.mailerService.sendMail({
        to: toEmail,
        subject: 'Bienvenue sur ByteBazaar ! 🎉',
        template: './welcome',
        context: {
          firstName: firstName || 'Membre',
          name: firstName || 'Membre',
        },
      });

      this.logger.log(`[Mail] Mail de bienvenue envoyé avec succès à ${toEmail}`);
    } catch (error) {
      this.logger.error(`[Mail] Échec d'envoi du mail de bienvenue à ${toEmail}`, error);
    }
  }

  /**
   * AJOUT : Envoi du mail de réinitialisation de mot de passe
   */
  async sendPasswordResetEmail(toEmail: string, firstName: string, token: string): Promise<void> {
    try {
      this.logger.log(`[Mail] Envoi du mail de réinitialisation de mot de passe à : ${toEmail}`);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const resetLink = `${frontendUrl}/reset-password?token=${token}`;

      await this.mailerService.sendMail({
        to: toEmail,
        subject: 'Réinitialisation de votre mot de passe - ByteBazaar',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #1e293b; border-radius: 16px; background-color: #131927; color: #ffffff;">
            <h2 style="color: #ffffff; margin-top: 0;">Bonjour ${firstName || 'Client'},</h2>
            <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
              Vous avez demandé la réinitialisation de votre mot de passe pour votre compte ByteBazaar.
            </p>
            <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
              Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe (ce lien expire dans 15 minutes) :
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

      this.logger.log(`[Mail] Mail de réinitialisation envoyé avec succès à ${toEmail}`);
    } catch (error) {
      this.logger.error(`[Mail] Échec d'envoi du mail de réinitialisation à ${toEmail}`, error);
      throw error;
    }
  }
}