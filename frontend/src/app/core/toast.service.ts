import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'cart' | 'error';
  /** Titre en français (traduit à l'affichage) */
  title: string;
  /** Texte libre déjà prêt (nom du produit, message de l'API…) */
  text?: string;
  image?: string | null;
}

const DURATION_MS = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  added(name: string, image?: string | null) {
    const title = 'Ajouté au panier'; // traduit à l'affichage
    this.show({ kind: 'cart', title, text: name, image });
  }

  error(text: string) {
    const title = "Impossible d'ajouter au panier"; // traduit à l'affichage
    this.show({ kind: 'error', title, text });
  }

  dismiss(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /** Survol : la notification reste affichée ; elle repart ensuite pour la durée complète */
  pause(id: number) {
    clearTimeout(this.timers.get(id));
  }

  resume(id: number) {
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), DURATION_MS),
    );
  }

  private show(toast: Omit<Toast, 'id'>) {
    const id = this.nextId++;
    // Trois au plus à l'écran : la plus ancienne laisse sa place
    this.toasts.update((list) => [...list.slice(-2), { ...toast, id }]);
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), DURATION_MS),
    );
  }
}
