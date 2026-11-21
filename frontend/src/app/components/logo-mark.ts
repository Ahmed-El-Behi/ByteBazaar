import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Logo ByteBazaar : « BB » dessiné en pixels (matrice 5 × 7 par lettre) sur une tuile bleu nuit,
 * avec deux pixels d'accent, orange en haut et cyan en bas du second B.
 * La taille vient de l'élément hôte (largeur / hauteur fixées par la feuille de style qui l'utilise).
 * Décoratif : il accompagne toujours le nom écrit « ByteBazaar ».
 */
type Tone = 'on' | 'orange' | 'cyan';

const B_ROWS = ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'];
const COLUMNS = 11; // B (5) + espace (1) + B (5)
const ROWS = 7;

// Grille dans une tuile de 64 × 64
const TILE = 64;
const CELL = 4.65;
const DOT = 3.9;
const X0 = (TILE - COLUMNS * CELL + (CELL - DOT)) / 2;
const Y0 = (TILE - ROWS * CELL + (CELL - DOT)) / 2;

interface Pixel {
  x: number;
  y: number;
  tone: Tone;
  /** Ordre d'allumage à l'affichage (diagonale, de haut à gauche vers bas à droite) */
  order: number;
}

function pixels(): Pixel[] {
  const list: Pixel[] = [];
  for (const offset of [0, 6]) {
    B_ROWS.forEach((row, r) =>
      [...row].forEach((cell, c) => {
        if (cell !== 'X') return;
        list.push({ x: offset + c, y: r, tone: 'on', order: offset + c + r });
      }),
    );
  }
  // Second B : le coin haut droit est orange, et un pixel cyan prolonge sa base
  const corner = list.find((p) => p.x === 9 && p.y === 0)!;
  corner.tone = 'orange';
  list.push({ x: 10, y: 6, tone: 'cyan', order: 16 });
  return list.map((p) => ({ ...p, x: X0 + p.x * CELL, y: Y0 + p.y * CELL }));
}

const PIXELS = pixels();
let instances = 0;

@Component({
  selector: 'app-logo-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1a2440" />
          <stop offset="1" stop-color="#0b1222" />
        </linearGradient>
      </defs>
      <rect class="tile" width="64" height="64" rx="15" [attr.fill]="'url(#' + gradientId + ')'" />
      @for (p of pixels; track $index) {
        <rect
          [class]="'px ' + p.tone"
          [attr.x]="p.x"
          [attr.y]="p.y"
          [attr.width]="dot"
          [attr.height]="dot"
          rx="0.95"
          [style.animation-delay.ms]="p.order * 38"
        />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      line-height: 0;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .px {
      fill: #f3f6fc;
      transform-box: fill-box;
      transform-origin: center;
      /* Allumage en diagonale à l'affichage, comme un écran qui démarre (une seule fois) */
      animation: boot 0.42s cubic-bezier(0.3, 1.4, 0.5, 1) backwards;
    }
    .orange {
      fill: #f7a215;
    }
    .cyan {
      fill: #22d3ee;
    }
    @keyframes boot {
      from {
        opacity: 0;
        transform: scale(0.2);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .px {
        animation: none;
      }
    }
  `,
})
export class LogoMark {
  // Identifiant propre à chaque logo (en-tête, pied de page…) : pas de doublon dans la page
  readonly gradientId = `bb-tile-${++instances}`;
  readonly pixels = PIXELS;
  readonly dot = DOT;
}
