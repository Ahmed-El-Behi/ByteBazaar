import { BadRequestException } from '@nestjs/common';
import { tr } from './i18n';

// Petits utilitaires de validation des corps de requête (aucune dépendance externe).
// Les erreurs renvoyées suivent le format attendu par le frontend : { message: string[] }.

export function badRequest(...messages: string[]): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: messages,
  });
}

/** « Quantité invalide » / « Invalid quantity » (le libellé est déjà traduit par l'appelant). */
function invalid(label: string): string {
  return tr(
    `${label} invalide`,
    `Invalid ${label.charAt(0).toLowerCase()}${label.slice(1)}`,
  );
}

export function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)
    : {};
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Entier (accepte "12" comme 12). Lève une erreur 400 si la valeur n'est pas un entier dans les bornes. */
export function int(
  value: unknown,
  label: string,
  { min = -Infinity, max = Infinity } = {},
): number {
  const n =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw badRequest(invalid(label));
  }
  return n;
}

/** Valeur parmi une liste fermée (enum Prisma). `undefined` si absente, 400 si inconnue. */
export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (
    typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
  )
    return value as T;
  throw badRequest(invalid(label));
}
