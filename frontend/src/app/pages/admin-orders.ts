import { Component, inject, signal, OnInit } from '@angular/core';
import { Icon } from '../components/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, type AdminOrder } from '../core/admin-api';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';
import { ProductNamePipe, TPipe, translate } from '../core/i18n';

const STATUS_ORDER: Record<string, number> = {
  PENDING: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  SHIPPED: 4,
  DELIVERED: 5,
  CANCELLED: 99,
};

interface StatusChangePayload {
  order: AdminOrder;
  targetStatus: string;
  selectElement?: HTMLSelectElement;
}

@Component({
  standalone: true,
  selector: 'app-admin-orders',
  imports: [Icon, CommonModule, FormsModule, TndPipe, TPipe, ProductNamePipe],
  template: `
    <div class="container page">
      <div class="header">
        <div>
          <h1>{{ 'Gestion des Commandes' | t }}</h1>
          <p class="muted">
            {{ 'Gérez le suivi des livraisons et les statuts des commandes clients.' | t }}
          </p>
        </div>
        <button class="btn primary btn-refresh-header" (click)="loadOrders()" type="button">
          <app-icon name="refresh" [size]="16" [stroke]="2" />
          {{ 'Actualiser' | t }}
        </button>
      </div>

      @if (errorMessage()) {
        <div class="alert red" style="margin-bottom: 1rem;">{{ errorMessage() }}</div>
      }

      @if (loading()) {
        <p class="muted">{{ 'Chargement des commandes admin...' | t }}</p>
      } @else {
        <div class="card table-wrapper">
          <table class="orders-table">
            <thead>
              <tr>
                <th>{{ 'Réf.' | t }}</th>
                <th>{{ 'Client' | t }}</th>
                <th>{{ 'Date' | t }}</th>
                <th>{{ 'Total' | t }}</th>
                <th>{{ 'Mode Paiement' | t }}</th>
                <th>{{ 'Statut Commande' | t }}</th>
                <th style="text-align: right;"></th>
              </tr>
            </thead>
            <tbody>
              @for (o of orders(); track o.id) {
                <tr [class.locked-row]="isLocked(o.status)">
                  <td>
                    <strong>{{ o.reference }}</strong>
                  </td>
                  <td>
                    <div class="client-info">
                      <span class="client-name"
                        >{{ o.user?.firstName }} {{ o.user?.lastName }}</span
                      >
                      <small class="muted">{{ o.user?.email }}</small>
                    </div>
                  </td>
                  <td>
                    <span class="date">{{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                  </td>
                  <td>
                    <strong>{{ o.total | tnd }}</strong>
                  </td>

                  <td>
                    <span
                      class="payment-method-badge"
                      [ngClass]="getPaymentMethodClass(o.paymentMethod)"
                    >
                      {{ getPaymentMethodLabel(o.paymentMethod) | t }}
                    </span>
                  </td>

                  <td>
                    <div class="select-container">
                      <select
                        class="select-badge"
                        [ngClass]="getOrderStatusClass(o.status)"
                        [value]="o.status"
                        [disabled]="isLocked(o.status)"
                        (change)="promptStatusChange($event, o)"
                      >
                        <option value="PENDING" [disabled]="isOptionDisabled(o.status, 'PENDING')">
                          {{ 'Reçue (En attente)' | t }}
                        </option>
                        <option
                          value="CONFIRMED"
                          [disabled]="isOptionDisabled(o.status, 'CONFIRMED')"
                        >
                          {{ 'Confirmée' | t }}
                        </option>
                        <option value="SHIPPED" [disabled]="isOptionDisabled(o.status, 'SHIPPED')">
                          {{ 'Expédiée' | t }}
                        </option>
                        <option
                          value="DELIVERED"
                          [disabled]="isOptionDisabled(o.status, 'DELIVERED')"
                        >
                          {{ 'Livrée' | t }}
                        </option>
                        <option
                          value="CANCELLED"
                          [disabled]="isOptionDisabled(o.status, 'CANCELLED')"
                        >
                          {{ 'Annulée' | t }}
                        </option>
                      </select>
                    </div>
                  </td>

                  <td style="text-align: right;">
                    <div class="action-cell">
                      <button
                        class="btn-action-icon"
                        (click)="toggleDetails(o.id)"
                        [class.open]="selectedOrderId() === o.id"
                        [title]="'Voir les détails' | t"
                      >
                        <app-icon name="chevronDown" [size]="18" [stroke]="2" />
                      </button>
                    </div>
                  </td>
                </tr>

                @if (selectedOrderId() === o.id) {
                  <tr class="details-row">
                    <td colspan="7">
                      <div class="details-box">
                        <h4>{{ 'Détails de la commande #{ref}' | t: { ref: o.reference } }}</h4>
                        <div class="items-list">
                          @for (item of o.items; track item.id) {
                            <div class="item-row">
                              <span>
                                <strong>{{ item.productName | productName }}</strong>
                                @if (item.productSku) {
                                  <small class="muted"
                                    >({{ 'SKU : {sku}' | t: { sku: item.productSku } }})</small
                                  >
                                }
                              </span>
                              <span
                                >x{{ item.quantity }} × {{ item.unitPrice | tnd }} =
                                <strong>{{ item.lineTotal | tnd }}</strong></span
                              >
                            </div>
                          }
                        </div>
                        <div class="details-summary">
                          <span>{{ 'Sous-total :' | t }} {{ o.subtotal | tnd }}</span> |
                          <span>{{ 'Livraison :' | t }} {{ o.shippingFee | tnd }}</span> |
                          <strong>{{ 'Total :' | t }} {{ o.total | tnd }}</strong>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }

      @if (pendingStatusChange(); as pending) {
        <div class="modal-backdrop" (click)="cancelStatusChange()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ 'Changer le statut de la commande' | t }}</h3>

            <p style="margin-top: 0.6rem; line-height: 1.5;">
              {{ 'Êtes-vous sûr de vouloir faire passer la commande' | t }}
              <strong>#{{ pending.order.reference }}</strong> {{ 'au statut :' | t }}
              <br />
              <span
                class="target-status-badge"
                [ngClass]="getOrderStatusClass(pending.targetStatus)"
              >
                {{ getOrderStatusLabel(pending.targetStatus) | t }}
              </span>
            </p>

            @if (pending.targetStatus === 'CANCELLED') {
              <div class="warning-box">
                <strong>{{ 'Attention :' | t }}</strong>
                {{
                  "L'annulation est irréversible. La commande sera définitivement verrouillée." | t
                }}
              </div>
            }

            <div class="modal-actions">
              <button class="btn" (click)="cancelStatusChange()">{{ 'Annuler' | t }}</button>
              <button
                class="btn primary"
                [class.danger]="pending.targetStatus === 'CANCELLED'"
                (click)="confirmStatusChange()"
              >
                {{ 'Confirmer' | t }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .page {
      padding-block: 1.5rem;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .header h1 {
      margin: 0;
    }
    .btn-refresh-header {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .table-wrapper {
      overflow-x: auto;
      padding: 0;
    }
    .orders-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .orders-table th,
    .orders-table td {
      padding: 1rem;
      border-bottom: 1px solid var(--border);
      font-size: var(--fs-md);
    }
    .orders-table th {
      background: var(--surface-2);
      color: var(--muted);
      font-weight: 700;
      font-size: var(--fs-sm);
      text-transform: uppercase;
    }

    .client-info {
      display: flex;
      flex-direction: column;
    }
    .client-name {
      font-weight: 600;
    }
    .date {
      font-size: var(--fs-md);
      color: var(--muted);
    }

    .action-cell {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
    }

    .btn-action-icon {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 50%;
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-action-icon:hover {
      background: var(--surface);
      color: var(--accent);
      border-color: var(--accent);
    }
    .btn-action-icon.open {
      transform: rotate(180deg);
      color: var(--accent);
      border-color: var(--accent);
    }

    .payment-method-badge {
      padding: 0.35rem 0.75rem;
      border-radius: 99px;
      font-size: var(--fs-xs);
      font-weight: 700;
      display: inline-block;
      text-transform: uppercase;
    }
    .pay-cod {
      background: color-mix(in srgb, var(--info) 12%, transparent);
      color: var(--info);
      border: 1px solid color-mix(in srgb, var(--info) 30%, transparent);
    }
    .pay-online {
      background: color-mix(in srgb, var(--green) 12%, transparent);
      color: var(--green);
      border: 1px solid color-mix(in srgb, var(--green) 30%, transparent);
    }

    .select-container {
      position: relative;
      display: inline-block;
    }

    .select-badge {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      padding: 0.45rem 2rem 0.45rem 0.85rem;
      border-radius: var(--r-sm);
      font-size: var(--fs-sm);
      font-weight: 700;
      border: 1px solid transparent;
      outline: none;
      cursor: pointer;
      transition: all 0.2s ease;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.6rem center;
    }

    .select-badge:hover:not(:disabled) {
      filter: brightness(1.15);
      transform: translateY(-1px);
    }

    .select-badge:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      background-image: none;
      padding-right: 0.85rem;
    }

    .select-badge option {
      background-color: var(--surface) !important;
      color: #ffffff !important;
      padding: 0.6rem;
      font-weight: 600;
      font-size: var(--fs-md);
    }
    .select-badge option:disabled {
      color: var(--muted) !important;
      background-color: var(--surface-2) !important;
    }

    .order-status-pending {
      background-color: color-mix(in srgb, var(--warn) 15%, transparent);
      color: var(--warn);
      border-color: color-mix(in srgb, var(--warn) 35%, transparent);
    }
    .order-status-confirmed {
      background-color: color-mix(in srgb, var(--info) 15%, transparent);
      color: var(--info);
      border-color: color-mix(in srgb, var(--info) 35%, transparent);
    }
    .order-status-shipped {
      background-color: color-mix(in srgb, var(--violet) 15%, transparent);
      color: var(--violet);
      border-color: color-mix(in srgb, var(--violet) 35%, transparent);
    }
    .order-status-delivered {
      background-color: color-mix(in srgb, var(--green) 15%, transparent);
      color: var(--green);
      border-color: color-mix(in srgb, var(--green) 35%, transparent);
    }
    .order-status-cancelled {
      background-color: color-mix(in srgb, var(--red) 15%, transparent);
      color: var(--red);
      border-color: color-mix(in srgb, var(--red) 35%, transparent);
    }

    .locked-row {
      opacity: 0.9;
    }
    .details-row {
      background: var(--surface-2);
    }
    .details-box {
      padding: 1rem;
    }
    .details-box h4 {
      margin: 0 0 0.8rem 0;
    }
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 0.8rem;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      font-size: var(--fs-md);
    }
    .details-summary {
      border-top: 1px solid var(--border);
      padding-top: 0.6rem;
      font-size: var(--fs-md);
      text-align: right;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      display: grid;
      place-items: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-card {
      background: var(--surface-2, var(--surface));
      border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
      border-radius: var(--r-md);
      padding: 1.6rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
    }
    .modal-card h3 {
      margin: 0;
      font-size: var(--fs-lg);
      font-weight: 700;
    }

    .target-status-badge {
      display: inline-block;
      margin-top: 0.6rem;
      padding: 0.35rem 0.8rem;
      border-radius: var(--r-sm);
      font-weight: 700;
      font-size: var(--fs-md);
      border: 1px solid transparent;
    }

    .warning-box {
      margin-top: 0.9rem;
      background: color-mix(in srgb, var(--red) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
      color: var(--red);
      padding: 0.75rem;
      border-radius: var(--r-sm);
      font-size: var(--fs-sm);
      line-height: 1.4;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.6rem;
      margin-top: 1.4rem;
    }
  `,
})
export class AdminOrdersPage implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  orders = signal<AdminOrder[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  selectedOrderId = signal<number | null>(null);

  pendingStatusChange = signal<StatusChangePayload | null>(null);

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading.set(true);
    this.adminApi.getAllOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = apiErrors(err);
        this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        this.loading.set(false);
      },
    });
  }

  toggleDetails(id: number) {
    this.selectedOrderId.set(this.selectedOrderId() === id ? null : id);
  }

  isLocked(status: string): boolean {
    return status === 'CANCELLED' || status === 'DELIVERED';
  }

  isOptionDisabled(currentStatus: string, targetStatus: string): boolean {
    if (this.isLocked(currentStatus)) {
      return true;
    }
    if (targetStatus === 'CANCELLED') {
      return false;
    }
    const currentRank = STATUS_ORDER[currentStatus] || 0;
    const targetRank = STATUS_ORDER[targetStatus] || 0;
    return targetRank < currentRank;
  }

  promptStatusChange(event: Event, order: AdminOrder) {
    const selectElement = event.target as HTMLSelectElement;
    const targetStatus = selectElement.value;

    if (targetStatus === order.status) return;

    this.pendingStatusChange.set({
      order,
      targetStatus,
      selectElement,
    });
  }

  cancelStatusChange() {
    const pending = this.pendingStatusChange();
    if (pending?.selectElement) {
      pending.selectElement.value = pending.order.status; // Rétablit l'ancien statut visuellement
    }
    this.pendingStatusChange.set(null);
  }

  confirmStatusChange() {
    const pending = this.pendingStatusChange();
    if (!pending) return;

    const { order, targetStatus, selectElement } = pending;

    this.adminApi.updateOrderStatus(order.id, { status: targetStatus }).subscribe({
      next: (updatedOrder) => {
        this.orders.update((list) =>
          list.map((o) => (o.id === order.id ? { ...o, status: updatedOrder.status } : o)),
        );
        this.pendingStatusChange.set(null);
      },
      error: (err) => {
        if (selectElement) {
          selectElement.value = order.status;
        }
        const msg = apiErrors(err);
        this.errorMessage.set(
          translate('Erreur lors de la mise à jour :') +
            ' ' +
            (Array.isArray(msg) ? msg.join(', ') : msg),
        );
        this.pendingStatusChange.set(null);
      },
    });
  }

  /** Libellés en français, traduits à l'affichage */
  getPaymentMethodLabel(method?: string): string {
    // i18n
    switch (method) {
      case 'CASH_ON_DELIVERY':
        return 'À la livraison';
      case 'PAYPAL':
        return 'PayPal';
      case 'BANK_TRANSFER':
        return 'Virement';
      case 'CARD':
        return 'Carte Bancaire';
      default:
        return method || '—';
    }
    // /i18n
  }

  getPaymentMethodClass(method?: string): string {
    if (method === 'CASH_ON_DELIVERY') {
      return 'pay-cod';
    }
    return 'pay-online';
  }

  getOrderStatusLabel(status: string): string {
    // i18n
    switch (status) {
      case 'PENDING':
        return 'Reçue (En attente)';
      case 'CONFIRMED':
        return 'Confirmée';
      case 'SHIPPED':
        return 'Expédiée';
      case 'DELIVERED':
        return 'Livrée';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return status;
    }
    // /i18n
  }

  getOrderStatusClass(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'order-status-pending';
      case 'CONFIRMED':
        return 'order-status-confirmed';
      case 'SHIPPED':
        return 'order-status-shipped';
      case 'DELIVERED':
        return 'order-status-delivered';
      case 'CANCELLED':
        return 'order-status-cancelled';
      default:
        return '';
    }
  }
}
