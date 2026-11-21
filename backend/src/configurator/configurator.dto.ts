import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim, invalid, msg } from '../common/validation';

const NAME_REQUIRED = msg(
  'Donnez un nom à votre configuration',
  'Give your configuration a name',
);
const INVALID_ID = invalid('Identifiant de composant', 'Component ID');
const NO_PART = msg(
  'Choisissez au moins un composant',
  'Choose at least one component',
);

/** Configuration enregistrée : refusée par le service si les pièces sont incompatibles entre elles. */
export class ConfigurationDto {
  @ApiProperty({ example: 'PC gaming 1440p', maxLength: 80 })
  @Trim()
  @IsString({ message: NAME_REQUIRED })
  @IsNotEmpty({ message: NAME_REQUIRED })
  @MaxLength(80, {
    message: msg(
      'Le nom est trop long (80 caractères maximum)',
      'The name is too long (80 characters maximum)',
    ),
  })
  name!: string;

  @ApiProperty({
    type: [Number],
    example: [2494, 742, 148],
    description: 'Identifiants des composants (aussi accepté : « 2494,742 »)',
  })
  // Le service acceptait aussi une liste séparée par des virgules et des nombres écrits en texte
  @Transform(({ value }: { value: unknown }) => {
    const list = typeof value === 'string' ? value.split(',') : value;
    return Array.isArray(list)
      ? list.map((v: unknown) =>
          typeof v === 'string' && v.trim() !== '' ? Number(v) : v,
        )
      : list;
  })
  @IsArray({ message: NO_PART })
  @ArrayNotEmpty({ message: NO_PART })
  @IsInt({ each: true, message: INVALID_ID })
  @Min(1, { each: true, message: INVALID_ID })
  productIds!: number[];
}
