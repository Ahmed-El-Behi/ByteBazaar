import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Icon, type IconName } from './icon';
import { TPipe } from '../core/i18n';
import { ORDER_STEPS, STATUS_LABELS, type OrderEvent, type OrderStatus } from '../core/orders-api';

const STEP_ICONS: Record<OrderStatus, IconName> = {
  PENDING: 'receipt',
  CONFIRMED: 'check',
  PREPARING: 'package',
  SHIPPED: 'truck',
  DELIVERED: 'checkCircle',
  CANCELLED: 'circleX',
};

interface Step {
  status: OrderStatus;
  label: string;
  icon: IconName;
  date: string | null;
  state: 'done' | 'current' | 'todo' | 'cancelled';
}

/**
 * Frise de suivi d'une commande : les étapes franchies portent leur date (historique),
 * l'étape en cours est mise en avant. Une commande annulée s'arrête sur l'annulation.
 * Horizontale sur grand écran, verticale sur téléphone.
 */
@Component({
  selector: 'app-order-timeline',
  imports: [Icon, TPipe, DatePipe],
  template: `
    <ol class="timeline" [class.compact]="compact()">
      @for (s of steps(); track s.status) {
        <li [class]="s.state">
          <span class="dot"
            ><app-icon [name]="s.icon" [size]="compact() ? 13 : 16" [stroke]="2.2"
          /></span>
          <span class="text">
            <span class="label">{{ s.label | t }}</span>
            @if (!compact() && s.date) {
              <time [attr.datetime]="s.date">{{ s.date | date: 'dd/MM/yyyy · HH:mm' }}</time>
            }
          </span>
        </li>
      }
    </ol>
  `,
  styles: `
    .timeline {
      --size: 34px;
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .timeline.compact {
      --size: 24px;
    }
    li {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.45rem;
      text-align: center;
      min-width: 0;
    }
    /* Trait vers l'étape précédente */
    li + li::before {
      content: '';
      position: absolute;
      top: calc(var(--size) / 2 - 1.5px);
      right: calc(50% + var(--size) / 2 + 4px);
      left: calc(-50% + var(--size) / 2 + 4px);
      height: 3px;
      border-radius: 3px;
      background: var(--border);
    }
    li.done + li::before,
    li.done + li.current::before,
    li.done + li.cancelled::before {
      background: var(--green);
    }
    .dot {
      position: relative;
      display: grid;
      place-items: center;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      color: var(--muted);
      background: var(--surface-2);
      box-shadow: inset 0 0 0 2px var(--border);
    }
    .done .dot {
      color: #fff;
      background: var(--green);
      box-shadow: none;
    }
    .current .dot {
      color: var(--on-accent);
      background: var(--accent);
      box-shadow: 0 0 0 5px var(--accent-soft);
    }
    .cancelled .dot {
      color: #fff;
      background: var(--red);
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--red) 16%, transparent);
    }
    .text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
    }
    .label {
      font-size: var(--fs-sm);
      font-weight: 700;
      color: var(--muted);
    }
    .done .label,
    .current .label {
      color: var(--text);
    }
    .cancelled .label {
      color: var(--red);
    }
    time {
      font-size: var(--fs-xs);
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .compact .label {
      font-size: var(--fs-2xs);
    }

    @media (max-width: 640px) {
      .timeline:not(.compact) {
        flex-direction: column;
        gap: 1.1rem;
      }
      .timeline:not(.compact) li {
        flex-direction: row;
        text-align: left;
        gap: 0.8rem;
      }
      .timeline:not(.compact) li + li::before {
        top: calc(-1.1rem + 4px);
        bottom: calc(100% + 4px);
        left: calc(var(--size) / 2 - 1.5px);
        right: auto;
        width: 3px;
        height: auto;
      }
      .compact .label {
        display: none;
      }
    }
  `,
})
export class OrderTimeline {
  readonly status = input.required<OrderStatus>();
  readonly events = input<OrderEvent[]>([]);
  readonly compact = input(false);

  readonly steps = computed<Step[]>(() => {
    const status = this.status();
    const dates = new Map<OrderStatus, string>();
    for (const e of this.events()) dates.set(e.status, e.createdAt);

    const cancelled = status === 'CANCELLED';
    // Étape atteinte : la dernière étape normale passée (pour une commande annulée)
    const reached = cancelled
      ? Math.max(0, ...ORDER_STEPS.map((s, i) => (dates.has(s) ? i : 0)))
      : ORDER_STEPS.indexOf(status);
    const visible = cancelled ? ORDER_STEPS.slice(0, reached + 1) : ORDER_STEPS;

    const steps: Step[] = visible.map((s, i) => ({
      status: s,
      label: STATUS_LABELS[s],
      icon: STEP_ICONS[s],
      date: dates.get(s) ?? null,
      // Une commande livrée est terminée : toutes ses étapes sont « faites »
      state:
        cancelled || i < reached || (i === reached && s === 'DELIVERED')
          ? 'done'
          : i === reached
            ? 'current'
            : 'todo',
    }));
    if (cancelled)
      steps.push({
        status: 'CANCELLED',
        label: STATUS_LABELS.CANCELLED,
        icon: STEP_ICONS.CANCELLED,
        date: dates.get('CANCELLED') ?? null,
        state: 'cancelled',
      });
    return steps;
  });
}
