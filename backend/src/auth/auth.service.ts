import {
  BadRequestException,
  ConflictException,
  Injectable,
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

    // Déclenchement asynchrone de l'e-mail de bienvenue en arrière-plan
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

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER });
    if (!user) throw new UnauthorizedException('Compte introuvable');
    return user;
  }

  private async session<U extends { id: number; role: string }>(user: U) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, user };
  }
}