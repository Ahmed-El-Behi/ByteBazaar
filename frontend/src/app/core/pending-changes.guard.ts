import { CanDeactivateFn } from '@angular/router';
import { translate } from './i18n';

export interface ComponentCanDeactivate {
  canDeactivate: () => boolean;
}

export const pendingChangesGuard: CanDeactivateFn<ComponentCanDeactivate> = (component) => {
  if (component.canDeactivate && !component.canDeactivate()) {
    return confirm(
      translate(
        'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter cette page ?',
      ),
    );
  }
  return true;
};
