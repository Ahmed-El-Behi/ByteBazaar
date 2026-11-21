import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n';

const formatters = new Map<string, Intl.NumberFormat>();

/** Prix en dinars, au format de la langue choisie (« 3 365 TND » / « 3,365 TND »). Impur : suit le changement de langue. */
@Pipe({ name: 'tnd', pure: false })
export class TndPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: number): string {
    const locale = this.i18n.locale();
    let formatter = formatters.get(locale);
    if (!formatter)
      formatters.set(
        locale,
        (formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 })),
      );
    return `${formatter.format(value)} TND`;
  }
}
