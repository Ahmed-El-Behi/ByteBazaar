import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { I18nService, TPipe } from '../core/i18n';

export interface RevenuePoint {
  bucket: string;
  revenue: number;
  orders: number;
}

const HEIGHT = 240; // zone de tracé ; l'axe des dates s'ajoute en dessous
const AXIS = 28;
const PAD_TOP = 14;
const PAD_LEFT = 52;
const PAD_RIGHT = 14;

/** Graduations « rondes » de 0 au maximum (4 à 5 intervalles) */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/**
 * Courbe du chiffre d'affaires : une seule série (aire légère + trait de 2 px), réticule
 * qui suit le pointeur avec infobulle (date, CA, nombre de commandes), navigation au
 * clavier (flèches) et tableau équivalent pour les lecteurs d'écran.
 */
@Component({
  selector: 'app-revenue-chart',
  imports: [TPipe],
  template: `
    <div
      class="plot"
      tabindex="0"
      role="img"
      [attr.aria-label]="summary()"
      (pointerleave)="active.set(null)"
      (focus)="active.set(active() ?? points().length - 1)"
      (blur)="active.set(null)"
      (keydown)="onKey($event)"
    >
      <svg [attr.width]="width()" [attr.height]="height" aria-hidden="true">
        @for (t of geometry().ticks; track t.value) {
          <line
            class="grid"
            [attr.x1]="padLeft"
            [attr.x2]="width() - padRight"
            [attr.y1]="t.y"
            [attr.y2]="t.y"
          />
          <text class="tick" [attr.x]="padLeft - 8" [attr.y]="t.y + 4" text-anchor="end">
            {{ t.label }}
          </text>
        }
        @for (l of geometry().labels; track l.x) {
          <text class="tick" [attr.x]="l.x" [attr.y]="plotBottom + 20" text-anchor="middle">
            {{ l.text }}
          </text>
        }
        <path class="area" [attr.d]="geometry().area" />
        <path class="line" [attr.d]="geometry().line" />
        @if (geometry().last; as last) {
          <circle class="dot" [attr.cx]="last.x" [attr.cy]="last.y" r="4" />
        }
        @if (hover(); as h) {
          <line
            class="cross"
            [attr.x1]="h.x"
            [attr.x2]="h.x"
            [attr.y1]="padTop"
            [attr.y2]="plotBottom"
          />
          <circle class="dot" [attr.cx]="h.x" [attr.cy]="h.y" r="4.5" />
        }
      </svg>

      @if (hover(); as h) {
        <div class="tooltip" [style.left.px]="h.x" [class.flip]="h.x > width() * 0.65">
          <strong>{{ money(h.point.revenue) }}</strong>
          <span>{{ '{n} commande(s)' | t: { n: h.point.orders } }}</span>
          <small>{{ dateLabel(h.point.bucket, true) }}</small>
        </div>
      }
    </div>

    <div class="sr-only">
      <table>
        <caption>
          {{
            "Chiffre d'affaires par période" | t
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ 'Période' | t }}</th>
            <th scope="col">{{ "Chiffre d'affaires" | t }}</th>
            <th scope="col">{{ 'Commandes' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (p of points(); track p.bucket) {
            <tr>
              <td>{{ dateLabel(p.bucket, true) }}</td>
              <td>{{ money(p.revenue) }}</td>
              <td>{{ p.orders }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
    }
    .plot {
      position: relative;
      outline: none;
      border-radius: var(--r-md);
      touch-action: pan-y;
    }
    .plot:focus-visible {
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    svg {
      display: block;
      overflow: visible;
    }
    .grid {
      stroke: var(--border);
      stroke-width: 1;
    }
    .tick {
      fill: var(--muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .area {
      fill: var(--viz-series);
      opacity: 0.1;
    }
    .line {
      fill: none;
      stroke: var(--viz-series);
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .dot {
      fill: var(--viz-series);
      stroke: var(--surface);
      stroke-width: 2;
    }
    .cross {
      stroke: var(--muted);
      stroke-width: 1;
    }
    .tooltip {
      position: absolute;
      top: 0;
      transform: translateX(12px);
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 9rem;
      padding: 0.55rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      background: var(--surface);
      box-shadow: var(--shadow-lift);
      pointer-events: none;
      white-space: nowrap;
      z-index: 2;
    }
    .tooltip.flip {
      transform: translateX(calc(-100% - 12px));
    }
    .tooltip strong {
      font-size: var(--fs-md);
      color: var(--text);
    }
    .tooltip span {
      font-size: var(--fs-sm);
      color: var(--text-2);
    }
    .tooltip small {
      font-size: var(--fs-xs);
      color: var(--muted);
    }
    /* Tableau équivalent, lu par les lecteurs d'écran uniquement */
    .sr-only {
      position: absolute;
      top: 0;
      left: 0;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class RevenueChart {
  private readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  readonly points = input.required<RevenuePoint[]>();
  readonly granularity = input<'day' | 'month'>('day');

  readonly height = HEIGHT + AXIS;
  readonly padTop = PAD_TOP;
  readonly padLeft = PAD_LEFT;
  readonly padRight = PAD_RIGHT;
  readonly plotBottom = HEIGHT;

  readonly width = signal(640);
  readonly active = signal<number | null>(null);

  constructor() {
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) =>
        this.width.set(Math.max(280, Math.floor(entry.contentRect.width))),
      );
      observer.observe(this.host);
      // Réticule : seul un changement de point survolé relance l'affichage
      const plot = this.host.querySelector<HTMLElement>('.plot')!;
      const onMove = (event: PointerEvent) => this.onPointer(event);
      plot.addEventListener('pointermove', onMove, { passive: true });
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        plot.removeEventListener('pointermove', onMove);
      });
    });
  }

  readonly geometry = computed(() => {
    const pts = this.points();
    const w = this.width();
    const max = Math.max(...pts.map((p) => p.revenue), 0);
    const ticks = niceTicks(max);
    const top = ticks[ticks.length - 1];
    const innerW = w - PAD_LEFT - PAD_RIGHT;
    const x = (i: number) =>
      PAD_LEFT + (pts.length <= 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
    const y = (v: number) => HEIGHT - (v / top) * (HEIGHT - PAD_TOP);
    const coords = pts.map((p, i) => ({ x: x(i), y: y(p.revenue) }));

    const line = coords
      .map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join('');
    const area = coords.length
      ? `${line}L${coords[coords.length - 1].x.toFixed(1)},${HEIGHT}L${coords[0].x.toFixed(1)},${HEIGHT}Z`
      : '';

    // Au plus ~6 dates sous l'axe, régulièrement espacées
    const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor(innerW / 90))));
    const labels = pts
      .map((p, i) => ({ i, p }))
      .filter(({ i }) => i % every === 0)
      .map(({ i, p }) => ({ x: x(i), text: this.dateLabel(p.bucket) }));

    return {
      ticks: ticks.map((value) => ({ value, y: y(value), label: this.compact(value, top) })),
      line,
      area,
      labels,
      coords,
      last: coords[coords.length - 1] ?? null,
    };
  });

  readonly hover = computed(() => {
    const i = this.active();
    const g = this.geometry();
    if (i === null || !g.coords[i]) return null;
    return { ...g.coords[i], point: this.points()[i] };
  });

  readonly summary = computed(() => {
    const pts = this.points();
    const total = pts.reduce((s, p) => s + p.revenue, 0);
    const best = pts.reduce((a, b) => (b.revenue > a.revenue ? b : a), pts[0]);
    return this.i18n.t(
      "Chiffre d'affaires : {total} sur la période, maximum {best} le {date}. Utilisez les flèches pour parcourir les valeurs.",
      {
        total: this.money(total),
        best: best ? this.money(best.revenue) : '0',
        date: best ? this.dateLabel(best.bucket, true) : '',
      },
    );
  });

  onPointer(event: PointerEvent) {
    const pts = this.points();
    if (!pts.length) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const innerW = this.width() - PAD_LEFT - PAD_RIGHT;
    const ratio = (event.clientX - rect.left - PAD_LEFT) / innerW;
    this.active.set(Math.min(pts.length - 1, Math.max(0, Math.round(ratio * (pts.length - 1)))));
  }

  onKey(event: KeyboardEvent) {
    const last = this.points().length - 1;
    const current = this.active() ?? last;
    const next =
      event.key === 'ArrowLeft'
        ? current - 1
        : event.key === 'ArrowRight'
          ? current + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    this.active.set(Math.min(last, Math.max(0, next)));
  }

  money(value: number) {
    return `${new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 0 }).format(value)} TND`;
  }

  /** Même format pour toutes les graduations de l'axe, d'après la plus haute */
  private compact(value: number, top: number) {
    return new Intl.NumberFormat(this.i18n.locale(), {
      notation: top >= 10_000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(value);
  }

  dateLabel(bucket: string, long = false) {
    const month = this.granularity() === 'month';
    const date = new Date(`${month ? `${bucket}-01` : bucket}T12:00:00`);
    return new Intl.DateTimeFormat(
      this.i18n.locale(),
      month
        ? { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' }
        : long
          ? { weekday: 'short', day: 'numeric', month: 'long' }
          : { day: '2-digit', month: '2-digit' },
    ).format(date);
  }
}
