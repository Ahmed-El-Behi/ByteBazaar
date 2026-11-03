import { Pipe, PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

@Pipe({ name: 'tnd' })
export class TndPipe implements PipeTransform {
  transform(value: number): string {
    return `${formatter.format(value)} TND`;
  }
}