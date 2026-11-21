import { ValidationError, ValidationPipe } from '@nestjs/common';
import type { ValidationArguments, ValidationOptions } from 'class-validator';
import { ValidateIf, registerDecorator } from 'class-validator';
import { Transform } from 'class-transformer';
import { badRequest } from './input';
import { tr } from './i18n';

/**
 * Message de validation traduit au moment de la requête (la langue vient du middleware `common/i18n`).
 * Les textes sont ceux que les services renvoyaient déjà : le site affiche exactement les mêmes erreurs.
 */
export const msg = (fr: string, en: string) => () => tr(fr, en);

/** « Quantité invalide » / « Invalid quantity » : même formulation que `int()` et `oneOf()` de `input.ts`. */
export const invalid = (labelFr: string, labelEn: string) =>
  msg(
    `${labelFr} invalide`,
    `Invalid ${labelEn.charAt(0).toLowerCase()}${labelEn.slice(1)}`,
  );

/** Chaîne nettoyée des espaces de début et de fin (les autres types sont laissés tels quels pour être refusés). */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Comme `Trim`, puis en minuscules (adresses e-mail). */
export const TrimLower = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/** « 12 » → 12, comme `int()` l'acceptait ; toute autre valeur est laissée telle quelle (et refusée par `IsInt`). */
export const ToNumber = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  );

/** Facultatif au sens des services : absent, `null` ou chaîne vide → pas de contrôle (`IsOptional` ne couvre pas « »). */
export const Optional = () =>
  ValidateIf(
    (_object: object, value: unknown) =>
      value !== undefined && value !== null && value !== '',
  );

/** Messages des erreurs, dans l'ordre des propriétés du DTO, y compris dans les objets imbriqués. */
function messages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messages(error.children ?? []),
  ]);
}

/**
 * Validation de tous les corps de requête typés par un DTO :
 * - `whitelist` : les champs inconnus sont ignorés (retirés), jamais transmis aux services ;
 * - `stopAtFirstError` : une seule erreur par champ, comme avant ;
 * - erreurs au format attendu par le frontend : `{ statusCode: 400, message: string[] }`.
 */
export const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  stopAtFirstError: true,
  exceptionFactory: (errors) => badRequest(...messages(errors)),
});

export const ADDRESS_FIELDS = [
  'recipientName',
  'phone',
  'street',
  'city',
  'governorate',
  'postalCode',
] as const;

/**
 * Adresse complète : un seul message qui liste tous les champs manquants
 * (« Adresse incomplète : street, city »), comme le faisait le service.
 */
export function IsCompleteAddress(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCompleteAddress',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (_value: unknown, args: ValidationArguments) =>
          missingFields(args).length === 0,
        defaultMessage: (args: ValidationArguments) => {
          const missing = missingFields(args).join(', ');
          return tr(
            `Adresse incomplète : ${missing}`,
            `Incomplete address: ${missing}`,
          );
        },
      },
    });
}

function missingFields(args: ValidationArguments): string[] {
  const address = args.object as Record<string, unknown>;
  return ADDRESS_FIELDS.filter((key) => {
    const value = address[key];
    return typeof value !== 'string' || !value.trim();
  });
}
