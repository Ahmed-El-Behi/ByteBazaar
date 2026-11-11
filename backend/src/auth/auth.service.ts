import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { hashPassword, verifyPassword } from './password';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PUBLIC_USER = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  language: true,
  createdAt: true,
} as const;

function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(body: unknown) {
    const b = asRecord(body);
    const email = text(b.email).toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    const firstName = text(b.firstName);
    const lastName = text(b.lastName);
    const phone = text(b.phone) || null;
    const language = b.language === 'EN' ? 'EN' : 'FR';

    const errors: string[] = [];
    if (!EMAIL_RE.test(email)) errors.push('Adresse email invalide');
    if (password.length < 8) errors.push('Le mot de passe doit contenir au moins 8 caractères');
    if (password.length > 128) errors.push('Le mot de passe est trop long (128 caractères maximum)');
    if (!firstName) errors.push('Le prénom est requis');
    if (!lastName) errors.push('Le nom est requis');
    if (errors.length) {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: errors });
    }

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException('Un compte existe déjà avec cet email');

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        firstName,
        lastName,
        phone,
        language,
      },
      select: PUBLIC_USER,
    });

    console.log(`[Mail] Tentative d'envoi de mail de bienvenue à : ${user.email}`);
    this.mailService
      .sendWelcomeEmail(user.email, user.firstName || 'Membre')
      .then(() => {
        console.log(`[Mail] Mail de bienvenue envoyé avec succès à ${user.email}`);
      })
      .catch((err) => {
        console.error(`[Mail] Erreur lors de l'envoi du mail de bienvenue :`, err);
      });

    return this.session(user);
  }

  async login(body: unknown) {
    const b = asRecord(body);
    const email = text(b.email).toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';

    const found = await this.prisma.user.findUnique({
      where: { email },
      select: { ...PUBLIC_USER, passwordHash: true },
    });
    const invalid = new UnauthorizedException('Email ou mot de passe incorrect');
    if (!found) throw invalid;

    const { passwordHash, ...user } = found;
    if (!(await verifyPassword(password, passwordHash))) throw invalid;
    return this.session(user);
  }

  // DEMANDE DE MOT DE PASSE OUBLIÉ
  async forgotPassword(body: unknown) {
    const b = asRecord(body);
    const email = text(b.email).toLowerCase();

    if (!EMAIL_RE.test(email)) {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: ['Adresse email invalide'] });
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true },
    });

    // Exception 404 retournée au frontend (affichée en rouge)
    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: ["Cette adresse email n'existe pas dans notre base de données."],
      });
    }

    // Token JWT de réinitialisation temporaire (15 min)
    const resetToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, purpose: 'reset-password' },
      { expiresIn: '15m' },
    );

    console.log(`[Mail] Envoi du mail de réinitialisation à : ${user.email}`);

    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        user.firstName || 'Client',
        resetToken,
      );
      console.log(`[Mail] Mail de réinitialisation envoyé avec succès à ${user.email}`);
    } catch (err) {
      console.error(`[Mail] Erreur lors de l'envoi du mail de réinitialisation :`, err);
    }

    return {
      message: 'Un email contenant le lien de réinitialisation vous a été envoyé.',
    };
  }

  // RÉINITIALISATION DU MOT DE PASSE
  async resetPassword(body: unknown) {
    const b = asRecord(body);
    const token = text(b.token);
    const newPassword: string = typeof b.newPassword === 'string' ? b.newPassword : '';

    if (!token) {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: ['Token de réinitialisation manquant'] });
    }
    if (newPassword.length < 8) {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: ['Le mot de passe doit contenir au moins 8 caractères'] });
    }

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: ['Le lien de réinitialisation est invalide ou a expiré'] });
    }

    if (payload.purpose !== 'reset-password') {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: ['Token invalide'] });
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });

    return { message: 'Votre mot de passe a été réinitialisé avec succès.' };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER });
    if (!user) throw new UnauthorizedException('Compte introuvable');
    return user;
  }

  async updateProfile(userId: number, body: unknown) {
    const b = asRecord(body);
    const firstName = text(b.firstName);
    const lastName = text(b.lastName);
    const phone = text(b.phone);
    const currentPassword = typeof b.currentPassword === 'string' ? b.currentPassword : '';
    const newPassword = typeof b.newPassword === 'string' ? b.newPassword : '';

    const errors: string[] = [];
    if (b.firstName !== undefined && !firstName) errors.push('Le prénom ne peut pas être vide');
    if (b.lastName !== undefined && !lastName) errors.push('Le nom ne peut pas être vide');
    if (newPassword) {
      if (newPassword.length < 8) errors.push('Le nouveau mot de passe doit contenir au moins 8 caractères');
      if (newPassword.length > 128) errors.push('Le nouveau mot de passe est trop long');
      if (!currentPassword) errors.push('Le mot de passe actuel est requis pour définir un nouveau mot de passe');
    }

    if (errors.length) {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: errors });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Compte introuvable');

    const updateData: Record<string, any> = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (b.phone !== undefined) updateData.phone = phone || null;

    if (newPassword) {
      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new BadRequestException('Le mot de passe actuel est incorrect');
      }
      updateData.passwordHash = await hashPassword(newPassword);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: PUBLIC_USER,
    });

    return updatedUser;
  }

  private async session<U extends { id: number; role: string }>(user: U) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, user };
  }
}