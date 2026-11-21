import { Injectable } from '@angular/core';
import type { PreloadingStrategy, Route } from '@angular/router';
import { Observable, EMPTY, defer, switchMap, timer } from 'rxjs';

/** Le navigateur est libre (ou 2 s au plus tard, pour les navigateurs sans requestIdleCallback) */
function whenIdle(): Observable<unknown> {
  return new Observable((subscriber) => {
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(
        () => {
          subscriber.next(true);
          subscriber.complete();
        },
        { timeout: 2000 },
      );
      return () => cancelIdleCallback(handle);
    }
    const handle = setTimeout(() => {
      subscriber.next(true);
      subscriber.complete();
    }, 2000);
    return () => clearTimeout(handle);
  });
}

/**
 * Précharge le code des pages en arrière-plan, une fois la première page affichée et le
 * navigateur au repos : un clic ouvre ensuite la page sans attendre le téléchargement.
 * Le configurateur 3D (≈ 150 ko compressés) n'est préchargé que sur ordinateur, un peu plus
 * tard, et jamais en mode économie de données (sur mobile, il l'est à l'approche d'un lien :
 * voir App). L'administration, réservée à quelques comptes, n'est jamais préchargée.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreloading implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const path = route.path ?? '';
    if (path === 'admin' || path.startsWith('admin/')) return EMPTY;
    if (path === 'configurateur') {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection;
      const desktop = matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (!desktop || connection?.saveData) return EMPTY;
      return timer(5000).pipe(
        switchMap(() => whenIdle()),
        switchMap(() => defer(load)),
      );
    }
    // Petit délai : la première page charge ses données et ses images sans concurrence
    return timer(1500).pipe(
      switchMap(() => whenIdle()),
      switchMap(() => defer(load)),
    );
  }
}
