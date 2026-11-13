import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { ProductNamePipe, TPipe } from '../core/i18n';
import { ToastService } from '../core/toast.service';

/** Pile de notifications en haut à droite, sous l'en-tête. */
@Component({
  selector: 'app-toaster',
  imports: [Icon, RouterLink, TPipe, ProductNamePipe],
  template: `
    <div class="stack" aria-live="polite" aria-atomic="false">
      @for (t of toasts.toasts(); track t.id) {
        <div
          class="toast"
          [class.error]="t.kind === 'error'"
          role="status"
          (mouseenter)="toasts.pause(t.id)"
          (mouseleave)="toasts.resume(t.id)"
        >
          @if (t.kind === 'cart') {
            <span class="thumb">
              @if (t.image) {
                <img [src]="t.image" alt="" />
              } @else {
                <app-icon name="cart" [size]="20" />
              }
              <span class="tick"><app-icon name="check" [size]="11" [stroke]="3.2" /></span>
            </span>
          } @else {
            <span class="thumb warn"><app-icon name="warning" [size]="20" /></span>
          }

          <div class="body">
            <strong>{{ t.title | t }}</strong>
            @if (t.text) {
              <span class="text">{{ t.kind === 'cart' ? (t.text | productName) : t.text }}</span>
            }
            @if (t.kind === 'cart') {
              <a routerLink="/panier" class="link" (click)="toasts.dismiss(t.id)">
                {{ 'Voir le panier' | t }} <app-icon name="arrowRight" [size]="13" [stroke]="2.4" />
              </a>
            }
          </div>

          <button
            type="button"
            class="close"
            (click)="toasts.dismiss(t.id)"
            [attr.aria-label]="'Fermer' | t"
          >
            <app-icon name="close" [size]="15" />
          </button>
          <span class="timer"></span>
        </div>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed;
      z-index: 60;
      top: calc(var(--topbar-h, 72px) + 12px);
      right: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      width: min(360px, calc(100vw - 2rem));
      pointer-events: none;
    }
    .toast {
      position: relative;
      overflow: hidden;
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.75rem 0.8rem 0.85rem;
      border-radius: var(--r-lg);
      border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
      background: color-mix(in srgb, var(--surface) 94%, transparent);
      backdrop-filter: blur(14px);
      box-shadow: var(--shadow-lift);
      animation: toast-in 0.45s cubic-bezier(0.2, 0.9, 0.25, 1.15);
    }
    .toast.error {
      border-color: color-mix(in srgb, var(--red) 40%, var(--border));
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateX(28px) scale(0.96);
      }
    }

    .thumb {
      position: relative;
      flex: none;
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: radial-gradient(circle at 50% 40%, #fff, #eef1f8);
      color: var(--accent);
    }
    .thumb img {
      width: 86%;
      height: 86%;
      object-fit: contain;
      mix-blend-mode: multiply;
    }
    .thumb.warn {
      background: color-mix(in srgb, var(--red) 12%, transparent);
      color: var(--red);
    }
    .tick {
      position: absolute;
      right: -5px;
      bottom: -5px;
      display: grid;
      place-items: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--green);
      color: #fff;
      box-shadow: 0 0 0 3px var(--surface);
      animation: tick-in 0.4s 0.15s cubic-bezier(0.3, 1.6, 0.5, 1) backwards;
    }
    @keyframes tick-in {
      from {
        transform: scale(0);
      }
    }

    .body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .body strong {
      font-size: var(--fs-md);
    }
    .text {
      font-size: var(--fs-sm);
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .error .text {
      white-space: normal;
    }
    .link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      margin-top: 0.2rem;
      font-size: var(--fs-sm);
      font-weight: 700;
      color: var(--accent);
    }
    .link:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .close {
      align-self: flex-start;
      flex: none;
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--muted);
      transition:
        background 0.15s,
        color 0.15s;
    }
    .close:hover {
      background: var(--surface-2);
      color: var(--text);
    }

    /* Barre de temps restant (s'arrête au survol) */
    .timer {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 3px;
      width: 100%;
      transform-origin: left;
      background: linear-gradient(90deg, var(--accent), var(--pink));
      animation: timer 4s linear forwards;
    }
    .error .timer {
      background: var(--red);
    }
    .toast:hover .timer {
      animation-play-state: paused;
    }
    @keyframes timer {
      to {
        transform: scaleX(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast,
      .tick {
        animation: none;
      }
      .timer {
        display: none;
      }
    }
  `,
})
export class Toaster {
  readonly toasts = inject(ToastService);
}
