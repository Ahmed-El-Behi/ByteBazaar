import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { asRecord, badRequest, text } from '../common/input';
import { hashPassword, verifyPassword } from './password';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const RESET_PURPOSE = 'reset-password';

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

function passwordErrors(password: string, label = 'Le mot de passe'): string[] {
  if (password.length < PASSWORD_MIN)
    return [`${label} doit contenir au moins ${PASSWORD_MIN} caractères`];
  if (password.length > PASSWORD_MAX)
    return [`${label} est trop long (${PASSWORD_MAX} caractères maximum)`];
  return [];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
    errors.push(...passwordErrors(password));
    if (!firstName) errors.push('Le prénom est requis');
    if (!lastName) errors.push('Le nom est requis');
    if (errors.length) throw badRequest(...errors);

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException('Un compte existe déjà avec cet email');

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

    // Envoi en arrière-plan : une panne SMTP ne bloque pas l'inscription (MailService journalise l'erreur)
    void this.mailService.sendWelcomeEmail(user.email, user.firstName);

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
    const invalid = new UnauthorizedException(
      'Email ou mot de passe incorrect',
    );
    if (!found) throw invalid;

    const { passwordHash, ...user } = found;
    if (!(await verifyPassword(password, passwordHash))) throw invalid;
    return this.session(user);
  }

  // La réponse est identique que l'adresse existe ou non : on ne révèle pas quels emails ont un compte.
  async forgotPassword(body: unknown) {
    const email = text(asRecord(body).email).toLowerCase();
    if (!EMAIL_RE.test(email)) throw badRequest('Adresse email invalide');

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, passwordHash: true },
    });

    if (user) {
      // Signé avec une clé dérivée du mot de passe actuel : le lien devient invalide dès qu'il a servi.
      const token = await this.jwt.signAsync(
        { sub: user.id, purpose: RESET_PURPOSE },
        { expiresIn: '15m', secret: this.resetSecret(user.passwordHash) },
      );
      try {
        await this.mailService.sendPasswordResetEmail(
          user.email,
          user.firstName,
          token,
        );
      } catch (err) {
        this.logger.error(
          `Échec d'envoi du lien de réinitialisation (utilisateur #${user.id})`,
          err as Error,
        );
      }
    }

    return {
      message:
        'Si un compte est associé à cette adresse, un email contenant le lien de réinitialisation vient de vous être envoyé.',
    };
  }

  async resetPassword(body: unknown) {
    const b = asRecord(body);
    const token = text(b.token);
    const newPassword = typeof b.newPassword === 'string' ? b.newPassword : '';

    if (!token) throw badRequest('Token de réinitialisation manquant');
    const errors = passwordErrors(newPassword);
    if (errors.length) throw badRequest(...errors);

    const invalid = badRequest(
      'Le lien de réinitialisation est invalide ou a expiré',
    );

    // Lecture non vérifiée de l'identifiant, puis vérification avec la clé propre à cet utilisateur
    const claims = this.jwt.decode<{ sub?: unknown; purpose?: unknown } | null>(
      token,
    );
    if (
      !claims ||
      typeof claims.sub !== 'number' ||
      claims.purpose !== RESET_PURPOSE
    )
      throw invalid;

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw invalid;

    try {
      await this.jwt.verifyAsync(token, {
        secret: this.resetSecret(user.passwordHash),
      });
    } catch {
      throw invalid;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        passwordChangedAt: new Date(),
      },
    });

    return { message: 'Votre mot de passe a été réinitialisé avec succès.' };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER,
    });
    if (!user) throw new UnauthorizedException('Compte introuvable');
    return user;
  }

  async updateProfile(userId: number, body: unknown) {
    const b = asRecord(body);
    const firstName = text(b.firstName);
    const lastName = text(b.lastName);
    const phone = text(b.phone);
    const currentPassword =
      typeof b.currentPassword === 'string' ? b.currentPassword : '';
    const newPassword = typeof b.newPassword === 'string' ? b.newPassword : '';

    const errors: string[] = [];
    if (b.firstName !== undefined && !firstName)
      errors.push('Le prénom ne peut pas être vide');
    if (b.lastName !== undefined && !lastName)
      errors.push('Le nom ne peut pas être vide');
    if (newPassword) {
      errors.push(...passwordErrors(newPassword, 'Le nouveau mot de passe'));
      if (!currentPassword)
        errors.push(
          'Le mot de passe actuel est requis pour définir un nouveau mot de passe',
        );
    }
    if (errors.length) throw badRequest(...errors);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Compte introuvable');

    const data: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      passwordHash?: string;
    } = {};
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    if (b.phone !== undefined) data.phone = phone || null;

    if (newPassword) {
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        throw badRequest('Le mot de passe actuel est incorrect');
      }
      data.passwordHash = await hashPassword(newPassword);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: PUBLIC_USER,
    });
  }

  private resetSecret(passwordHash: string): string {
    return `${process.env.JWT_SECRET}:${RESET_PURPOSE}:${passwordHash}`;
  }

  private async session<U extends { id: number; role: string }>(user: U) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
    });
    return { accessToken, user };
  }
}
