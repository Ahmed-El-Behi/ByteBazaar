import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Trim, TrimLower, invalid, msg } from '../common/validation';

// Mêmes règles et mêmes messages que AuthService (qui garde ses contrôles en défense en profondeur)
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const INVALID_EMAIL = msg('Adresse email invalide', 'Invalid email address');

/** Longueur du mot de passe : « Le mot de passe doit contenir au moins 8 caractères », etc. */
function passwordRules(labelFr: string, labelEn: string) {
  const tooShort = msg(
    `${labelFr} doit contenir au moins ${PASSWORD_MIN} caractères`,
    `${labelEn} must contain at least ${PASSWORD_MIN} characters`,
  );
  const tooLong = msg(
    `${labelFr} est trop long (${PASSWORD_MAX} caractères maximum)`,
    `${labelEn} is too long (${PASSWORD_MAX} characters maximum)`,
  );
  return [
    IsString({ message: tooShort }),
    MinLength(PASSWORD_MIN, { message: tooShort }),
    MaxLength(PASSWORD_MAX, { message: tooLong }),
  ];
}

const apply =
  (...decorators: PropertyDecorator[]): PropertyDecorator =>
  (target, key) =>
    decorators.forEach((decorate) => decorate(target, key));

export class RegisterDto {
  @ApiProperty({ example: 'mariem.trabelsi@example.tn' })
  @TrimLower()
  @Matches(EMAIL_RE, { message: INVALID_EMAIL })
  email!: string;

  @ApiProperty({
    minLength: PASSWORD_MIN,
    maxLength: PASSWORD_MAX,
    example: 'motdepasse123',
  })
  @apply(...passwordRules('Le mot de passe', 'The password'))
  password!: string;

  @ApiProperty({ example: 'Mariem' })
  @Trim()
  @IsString({ message: msg('Le prénom est requis', 'First name is required') })
  @IsNotEmpty({
    message: msg('Le prénom est requis', 'First name is required'),
  })
  firstName!: string;

  @ApiProperty({ example: 'Trabelsi' })
  @Trim()
  @IsString({ message: msg('Le nom est requis', 'Last name is required') })
  @IsNotEmpty({ message: msg('Le nom est requis', 'Last name is required') })
  lastName!: string;

  @ApiPropertyOptional({ example: '98 123 456' })
  @IsOptional()
  @Trim()
  @IsString({ message: invalid('Téléphone', 'Phone') })
  phone?: string;

  @ApiPropertyOptional({
    enum: ['FR', 'EN'],
    default: 'FR',
    description: 'Langue des e-mails',
  })
  @IsOptional()
  @IsString({ message: invalid('Langue', 'Language') })
  language?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'mariem.trabelsi@example.tn' })
  @IsOptional()
  @IsString({
    message: msg(
      'Email ou mot de passe incorrect',
      'Incorrect email or password',
    ),
  })
  email?: string;

  @ApiProperty({ example: 'motdepasse123' })
  @IsOptional()
  @IsString({
    message: msg(
      'Email ou mot de passe incorrect',
      'Incorrect email or password',
    ),
  })
  password?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'mariem.trabelsi@example.tn' })
  @TrimLower()
  @Matches(EMAIL_RE, { message: INVALID_EMAIL })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description:
      'Jeton reçu dans le lien envoyé par e-mail (valable 15 minutes, usage unique)',
  })
  @Trim()
  @IsString({
    message: msg('Token de réinitialisation manquant', 'Missing reset token'),
  })
  @IsNotEmpty({
    message: msg('Token de réinitialisation manquant', 'Missing reset token'),
  })
  token!: string;

  @ApiProperty({
    minLength: PASSWORD_MIN,
    maxLength: PASSWORD_MAX,
    example: 'nouveaumotdepasse',
  })
  @apply(...passwordRules('Le mot de passe', 'The password'))
  newPassword!: string;
}

/** Tous les champs sont facultatifs : seuls ceux envoyés sont modifiés. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Mariem' })
  @IsOptional()
  @Trim()
  @IsString({
    message: msg(
      'Le prénom ne peut pas être vide',
      'First name cannot be empty',
    ),
  })
  @IsNotEmpty({
    message: msg(
      'Le prénom ne peut pas être vide',
      'First name cannot be empty',
    ),
  })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Trabelsi' })
  @IsOptional()
  @Trim()
  @IsString({
    message: msg('Le nom ne peut pas être vide', 'Last name cannot be empty'),
  })
  @IsNotEmpty({
    message: msg('Le nom ne peut pas être vide', 'Last name cannot be empty'),
  })
  lastName?: string;

  @ApiPropertyOptional({
    example: '98 123 456',
    description: 'Chaîne vide : supprime le numéro',
  })
  @IsOptional()
  @Trim()
  @IsString({ message: invalid('Téléphone', 'Phone') })
  phone?: string;

  @ApiPropertyOptional({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @ValidateIf(
    (dto: UpdateProfileDto) =>
      dto.newPassword !== undefined &&
      dto.newPassword !== null &&
      dto.newPassword !== '',
  )
  @apply(...passwordRules('Le nouveau mot de passe', 'The new password'))
  newPassword?: string;

  @ApiPropertyOptional({
    description: 'Obligatoire pour changer de mot de passe',
  })
  @ValidateIf((dto: UpdateProfileDto) => !!dto.newPassword)
  @IsString({
    message: msg(
      'Le mot de passe actuel est requis pour définir un nouveau mot de passe',
      'The current password is required to set a new password',
    ),
  })
  @IsNotEmpty({
    message: msg(
      'Le mot de passe actuel est requis pour définir un nouveau mot de passe',
      'The current password is required to set a new password',
    ),
  })
  currentPassword?: string;
}
