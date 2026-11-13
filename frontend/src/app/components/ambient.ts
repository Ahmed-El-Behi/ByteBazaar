import { Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * Fond d'ambiance : quelques grandes taches de couleur très floues (accent, rose, violet, cyan)
 * fixées derrière le contenu. Elles dérivent lentement d'elles-mêmes et glissent doucement
 * selon la progression du défilement (parallaxe légère), sans jamais quitter l'écran.
 * Volontairement discrètes : faible opacité, dégradés radiaux (pas de filtre de flou coûteux).
 */
@Component({
  selector: 'app-ambient',
  template: `
    <div class="blob b1"></div>
    <div class="blob b2"></div>
    <div class="blob b3"></div>
    <div class="blob b4"></div>
  `,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      --p: 0; /* progression du défilement, 0 → 1 */
      --o: 0.55; /* intensité générale (thème clair) */
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
    }
    :host-context([data-theme='dark']) {
      --o: 0.42;
    }

    .blob {
      position: absolute;
      border-radius: 50%;
      opacity: var(--o);
      will-change: transform;
      /* Glissement selon le défilement + dérive lente propre à chaque tache */
      translate: calc(var(--p) * var(--dx)) calc(var(--p) * var(--dy));
      animation: drift var(--t) ease-in-out infinite alternate;
    }
    .b1 {
      --dx: 12vw;
      --dy: 38vh;
      --t: 38s;
      width: 62vmax;
      height: 62vmax;
      left: -22vmax;
      top: -24vmax;
      background: radial-gradient(
        circle at center,
        color-mix(in srgb, var(--accent) 34%, transparent) 0%,
        transparent 62%
      );
    }
    .b2 {
      --dx: -16vw;
      --dy: 30vh;
      --t: 46s;
      width: 54vmax;
      height: 54vmax;
      right: -20vmax;
      top: 4vh;
      background: radial-gradient(
        circle at center,
        color-mix(in srgb, var(--pink) 30%, transparent) 0%,
        transparent 62%
      );
      animation-delay: -12s;
    }
    .b3 {
      --dx: 10vw;
      --dy: -34vh;
      --t: 52s;
      width: 50vmax;
      height: 50vmax;
      left: 18vw;
      bottom: -30vmax;
      background: radial-gradient(
        circle at center,
        color-mix(in srgb, #8b5cf6 24%, transparent) 0%,
        transparent 62%
      );
      animation-delay: -24s;
    }
    .b4 {
      --dx: -8vw;
      --dy: -26vh;
      --t: 60s;
      width: 40vmax;
      height: 40vmax;
      right: 6vw;
      bottom: -18vmax;
      background: radial-gradient(
        circle at center,
        color-mix(in srgb, #06b6d4 20%, transparent) 0%,
        transparent 62%
      );
      animation-delay: -36s;
    }
    @keyframes drift {
      0% {
        transform: translate(0, 0) scale(1);
      }
      50% {
        transform: translate(4vw, -3vh) scale(1.08);
      }
      100% {
        transform: translate(-3vw, 4vh) scale(0.95);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .blob {
        animation: none;
        translate: none;
      }
    }
  `,
})
export class Ambient {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      let frame = 0;
      // Progression lissée : les taches rattrapent la position de défilement en douceur
      let current = 0;
      let target = 0;
      const read = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        if (!frame) frame = requestAnimationFrame(step);
      };
      const step = () => {
        current += (target - current) * 0.08;
        host.style.setProperty('--p', current.toFixed(4));
        frame = Math.abs(target - current) > 0.0005 ? requestAnimationFrame(step) : 0;
      };
      window.addEventListener('scroll', read, { passive: true });
      window.addEventListener('resize', read, { passive: true });
      read();
      destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        window.removeEventListener('scroll', read);
        window.removeEventListener('resize', read);
      });
    });
  }
}
