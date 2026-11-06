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
}