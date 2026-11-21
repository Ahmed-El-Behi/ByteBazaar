import {
  Directive,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { I18nService } from '../core/i18n';

/**
 * Apparition douce au défilement : l'élément glisse et s'affiche quand il entre dans l'écran.
 * <section appReveal> … ou avec un délai : <div appReveal [revealDelay]="120">
 * (le style est global : voir « Apparition au défilement » dans styles.css)
 */
@Directive({ selector: '[appReveal]' })
export class Reveal {
  /** Délai d'apparition en millisecondes (effet de cascade) */
  readonly revealDelay = input(0);

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      el.style.setProperty('--reveal-delay', `${this.revealDelay()}ms`);
      if (typeof IntersectionObserver === 'undefined') {
        el.classList.add('in');
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            el.classList.add('in');
            observer.disconnect();
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
      );
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}

/** Compteur qui défile de 0 jusqu'à la valeur quand il devient visible (format français). */
@Directive({ selector: '[appCountUp]' })
export class CountUp {
  readonly appCountUp = input.required<number>();

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    const i18n = inject(I18nService);
    const format = () => new Intl.NumberFormat(i18n.locale());
    let frame = 0;
    let observer: IntersectionObserver | undefined;
    let visible = false;

    // La valeur arrive souvent après l'affichage (requête HTTP) : on relance à chaque changement
    effect(() => {
      this.appCountUp();
      i18n.lang(); // séparateur des milliers selon la langue
      if (visible) untracked(run);
    });

    const run = () => {
      const target = this.appCountUp();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced || !target) {
        el.textContent = format().format(target);
        return;
      }
      const start = performance.now();
      const duration = 1400;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 4);
        el.textContent = format().format(Math.round(target * eased));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(step);
    };

    afterNextRender(() => {
      el.textContent = '0';
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer?.disconnect();
          visible = true;
          run();
        }
      });
      observer.observe(el);
    });

    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    });
  }
}
