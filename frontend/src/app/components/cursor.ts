import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';

const TEXT =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]), textarea';
const LINK =
  'a, button, label, select, summary, .btn, .btn-sm, [role="button"], [role="switch"], input[type="checkbox"], input[type="radio"], input[type="range"], input[type="submit"]';
const ITEM = 'h1, h2, h3, h4, p, li, td, th, img, span, small, strong';

// Curseur personnalisé : un point, un anneau et une lueur qui le suivent avec un léger retard.
// L'anneau change de couleur et de taille selon ce qui est survolé.
@Component({
  selector: 'app-cursor',
  template: `
    <div class="c glow" #glow><i></i></div>
    <div class="c ring" #ring><i></i></div>
    <div class="c dot" #dot><i></i></div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.25s;
    }
    :host(.on) {
      opacity: 1;
    }
    .c {
      position: fixed;
      left: 0;
      top: 0;
      will-change: transform;
    }
    .c i {
      position: absolute;
      display: block;
      border-radius: 50%;
      transition:
        transform 0.25s cubic-bezier(0.3, 0.7, 0.3, 1),
        background 0.25s,
        border-color 0.25s,
        opacity 0.2s;
    }

    .dot i {
      width: 8px;
      height: 8px;
      margin: -4px 0 0 -4px;
      background: var(--cursor-a);
    }
    .ring i {
      width: 38px;
      height: 38px;
      margin: -19px 0 0 -19px;
      border: 1.5px solid color-mix(in srgb, var(--cursor-a) 65%, transparent);
    }
    .glow i {
      width: 130px;
      height: 130px;
      margin: -65px 0 0 -65px;
      background: radial-gradient(
        circle,
        color-mix(in srgb, var(--cursor-a) 24%, transparent),
        transparent 65%
      );
    }

    /* contenu : texte, images */
    :host([data-state='item']) .ring i {
      transform: scale(0.8);
      border-color: var(--cursor-b);
    }
    :host([data-state='item']) .dot i {
      background: var(--cursor-b);
    }
    :host([data-state='item']) .glow i {
      background: radial-gradient(
        circle,
        color-mix(in srgb, var(--cursor-b) 22%, transparent),
        transparent 65%
      );
    }

    /* cartes */
    :host([data-state='card']) .ring i {
      transform: scale(1.9);
      border-color: color-mix(in srgb, var(--cursor-b) 55%, transparent);
    }
    :host([data-state='card']) .dot i {
      transform: scale(0.6);
      background: var(--cursor-b);
    }
    :host([data-state='card']) .glow i {
      background: radial-gradient(
        circle,
        color-mix(in srgb, var(--cursor-b) 26%, transparent),
        transparent 65%
      );
    }

    /* liens, boutons, interrupteurs */
    :host([data-state='link']) .ring i {
      transform: scale(1.5);
      border-color: var(--cursor-b);
      background: color-mix(in srgb, var(--cursor-b) 25%, transparent);
    }
    :host([data-state='link']) .dot i {
      transform: scale(0.5);
      background: var(--cursor-b);
    }
    :host([data-state='link']) .glow i {
      transform: scale(1.3);
      background: radial-gradient(
        circle,
        color-mix(in srgb, var(--cursor-b) 32%, transparent),
        transparent 65%
      );
    }

    /* champs de saisie : on laisse le curseur texte natif */
    :host([data-state='text']) .dot i,
    :host([data-state='text']) .ring i {
      opacity: 0;
    }

    :host(.down) .ring i {
      transform: scale(0.75) !important;
    }
  `,
})
export class Cursor {
  private host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private glow = viewChild.required<ElementRef<HTMLElement>>('glow');
  private ring = viewChild.required<ElementRef<HTMLElement>>('ring');
  private dot = viewChild.required<ElementRef<HTMLElement>>('dot');

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.start()));
  }

  private start() {
    // Uniquement avec une vraie souris, et sans préférence « réduire les animations »
    if (
      !matchMedia('(hover: hover) and (pointer: fine)').matches ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const root = document.documentElement;
    root.classList.add('custom-cursor');

    // k = vitesse de rattrapage : plus il est petit, plus le cercle traîne derrière
    const trail = [
      { el: this.glow().nativeElement, k: 0.09, x: 0, y: 0 },
      { el: this.ring().nativeElement, k: 0.2, x: 0, y: 0 },
      { el: this.dot().nativeElement, k: 0.9, x: 0, y: 0 },
    ];
    let tx = 0;
    let ty = 0;
    let raf = 0;
    let shown = false;

    const tick = () => {
      let moving = false;
      for (const p of trail) {
        p.x += (tx - p.x) * p.k;
        p.y += (ty - p.y) * p.k;
        p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
        if (Math.abs(tx - p.x) > 0.05 || Math.abs(ty - p.y) > 0.05) moving = true;
      }
      raf = moving ? requestAnimationFrame(tick) : 0;
    };

    const setState = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      let state = 'default';
      if (el?.closest(TEXT)) state = 'text';
      else if (el?.closest(LINK)) state = 'link';
      else if (el?.closest('.card')) state = 'card';
      else if (el?.closest(ITEM)) state = 'item';
      this.host.dataset['state'] = state;
    };

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!shown) {
        trail.forEach((p) => ((p.x = tx), (p.y = ty)));
        shown = true;
        this.host.classList.add('on');
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onOver = (e: MouseEvent) => setState(e.target);
    const onDown = () => this.host.classList.add('down');
    const onUp = () => this.host.classList.remove('down');
    const onLeave = () => this.host.classList.remove('on');
    const onEnter = () => shown && this.host.classList.add('on');

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    root.addEventListener('mouseleave', onLeave);
    root.addEventListener('mouseenter', onEnter);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(raf);
      root.classList.remove('custom-cursor');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      root.removeEventListener('mouseleave', onLeave);
      root.removeEventListener('mouseenter', onEnter);
    });
  }
}
