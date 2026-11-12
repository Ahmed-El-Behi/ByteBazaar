import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, type AdminOrder } from '../core/admin-api';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';

const STATUS_ORDER: Record<string, number> = {
  PENDING: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  SHIPPED: 4,
  DELIVERED: 5,
  CANCELLED: 99
};

interface StatusChangePayload {
  order: AdminOrder;
  targetStatus: string;
  selectElement?: HTMLSelectElement;
}

@Component({
  standalone: true,
  selector: 'app-admin-orders',
  imports: [CommonModule, FormsModule, TndPipe],
  template: `
    <div class="container page">
      <div class="header">
        <div>
          <h1>Gestion des Commandes</h1>
          <p class="muted">Gérez le suivi des livraisons et les statuts des commandes clients.</p>
        </div>
        <button class="btn primary btn-refresh-header" (click)="loadOrders()" type="button">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6" />
            <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M2.5 16l1.2 0.8A10 10 0 0 0 22 12.5" />
          </svg>
          Actualiser
        </button>
      </div>

      @if (errorMessage()) {
        <div class="alert red" style="margin-bottom: 1rem;">{{ errorMessage() }}</div>
      }

      @if (loading()) {
        <p class="muted">Chargement des commandes admin...</p>
      } @else {
        <div class="card table-wrapper">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total</th>
                <th>Mode Paiement</th>
                <th>Statut Commande</th>
                <th style="text-align: right;"></th>
              </tr>
            </thead>
            <tbody>
              @for (o of orders(); track o.id) {
                <tr [class.locked-row]="isLocked(o.status)">
                  <td><strong>{{ o.reference }}</strong></td>
                  <td>
                    <div class="client-info">
                      <span class="client-name">{{ o.user?.firstName }} {{ o.user?.lastName }}</span>
                      <small class="muted">{{ o.user?.email }}</small>
                    </div>
                  </td>
                  <td><span class="date">{{ o.createdAt | date:'dd/MM/yyyy HH:mm' }}</span></td>
                  <td><strong>{{ o.total | tnd }}</strong></td>
                  
                  <!-- MODE PAIEMENT -->
                  <td>
                    <span class="payment-method-badge" [ngClass]="getPaymentMethodClass(o.paymentMethod)">
                      {{ getPaymentMethodLabel(o.paymentMethod) }}
                    </span>
                  </td>

                  <!-- STATUT COMMANDE AVEC SÉLECTEUR PERSONNALISÉ -->
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
                          Reçue (En attente)
                        </option>
                        <option value="CONFIRMED" [disabled]="isOptionDisabled(o.status, 'CONFIRMED')">
                          Confirmée
                        </option>
                        <option value="SHIPPED" [disabled]="isOptionDisabled(o.status, 'SHIPPED')">
                          Expédiée
                        </option>
                        <option value="DELIVERED" [disabled]="isOptionDisabled(o.status, 'DELIVERED')">
                          Livrée
                        </option>
                        <option value="CANCELLED" [disabled]="isOptionDisabled(o.status, 'CANCELLED')">
                          Annulée
                        </option>
                      </select>
                    </div>
                  </td>

                  <!-- BOUTON DÉTAILS -->
                  <td style="text-align: right;">
                    <div class="action-cell">
                      <button 
                        class="btn-action-icon" 
                        (click)="toggleDetails(o.id)" 
                        [class.open]="selectedOrderId() === o.id" 
                        title="Voir les détails"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- DÉTAILS DÉROULANTS -->
                @if (selectedOrderId() === o.id) {
                  <tr class="details-row">
                    <td colspan="7">
                      <div class="details-box">
                        <h4>Détails de la commande #{{ o.reference }}</h4>
                        <div class="items-list">
                          @for (item of o.items; track item.id) {
                            <div class="item-row">
                              <span>
                                <strong>{{ item.productName }}</strong> 
                                @if (item.productSku) { <small class="muted">(SKU: {{ item.productSku }})</small> }
                              </span>
                              <span>x{{ item.quantity }} × {{ item.unitPrice | tnd }} = <strong>{{ item.lineTotal | tnd }}</strong></span>
                            </div>
                          }
                        </div>
                        <div class="details-summary">
                          <span>Sous-total: {{ o.subtotal | tnd }}</span> |
                          <span>Livraison: {{ o.shippingFee | tnd }}</span> |
                          <strong>Total: {{ o.total | tnd }}</strong>
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

      <!-- MODAL DE CONFIRMATION DE CHANGEMENT DE STATUT -->
      @if (pendingStatusChange(); as pending) {
        <div class="modal-backdrop" (click)="cancelStatusChange()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>Changer le statut de la commande</h3>
            
            <p style="margin-top: 0.6rem; line-height: 1.5;">
              Êtes-vous sûr de vouloir faire passer la commande <strong>#{{ pending.order.reference }}</strong> au statut :
              <br />
              <span class="target-status-badge" [ngClass]="getOrderStatusClass(pending.targetStatus)">
                {{ getOrderStatusLabel(pending.targetStatus) }}
              </span>
            </p>

            @if (pending.targetStatus === 'CANCELLED') {
              <div class="warning-box">
                <strong>Attention :</strong> L'annulation est irréversible. La commande sera définitivement verrouillée.
              </div>
            }

            <div class="modal-actions">
              <button class="btn secondary" (click)="cancelStatusChange()">Annuler</button>
              <button class="btn primary" [class.danger]="pending.targetStatus === 'CANCELLED'" (click)="confirmStatusChange()">Confirmer</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .page { padding-block: 1.5rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .header h1 { margin: 0; }
    .btn-refresh-header { display: inline-flex; align-items: center; gap: 0.5rem; }

    .table-wrapper { overflow-x: auto; padding: 0; }
    .orders-table { width: 100%; border-collapse: collapse; text-align: left; }
    .orders-table th, .orders-table td { padding: 1rem; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    .orders-table th { background: var(--surface-2); color: var(--muted); font-weight: 700; font-size: 0.8rem; text-transform: uppercase; }
    
    .client-info { display: flex; flex-direction: column; }
    .client-name { font-weight: 600; }
    .date { font-size: 0.85rem; color: var(--muted); }

    .action-cell {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
    }

    .btn-action-icon {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
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
      font-size: 0.75rem;
      font-weight: 700;
      display: inline-block;
      text-transform: uppercase;
    }
    .pay-cod { background: rgba(59, 130, 246, 0.12); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
    .pay-online { background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }

    /* DESIGN PREMIUM DU SELECTEUR DE STATUT */
    .select-container {
      position: relative;
      display: inline-block;
    }

    .select-badge {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      padding: 0.45rem 2rem 0.45rem 0.85rem;
      border-radius: 10px;
      font-size: 0.82rem;
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

    /* FORMATAGE NATIVE DROPDOWN OPTIONS */
    .select-badge option {
      background-color: #111827 !important;
      color: #ffffff !important;
      padding: 0.6rem;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .select-badge option:disabled {
      color: #4b5563 !important;
      background-color: #1f2937 !important;
    }

    .order-status-pending { background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; border-color: rgba(245, 158, 11, 0.35); }
    .order-status-confirmed { background-color: rgba(59, 130, 246, 0.15); color: #3b82f6; border-color: rgba(59, 130, 246, 0.35); }
    .order-status-shipped { background-color: rgba(168, 85, 247, 0.15); color: #a855f7; border-color: rgba(168, 85, 247, 0.35); }
    .order-status-delivered { background-color: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.35); }
    .order-status-cancelled { background-color: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.35); }

    .locked-row { opacity: 0.9; }
    .details-row { background: var(--surface-2); }
    .details-box { padding: 1rem; }
    .details-box h4 { margin: 0 0 0.8rem 0; }
    .items-list { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.8rem; }
    .item-row { display: flex; justify-content: space-between; font-size: 0.88rem; }
    .details-summary { border-top: 1px solid var(--border); padding-top: 0.6rem; font-size: 0.9rem; text-align: right; }

    /* MODAL DE CONFIRMATION SOIGNÉ */
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
      background: var(--surface-2, #111827);
      border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
      border-radius: 16px;
      padding: 1.6rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
    }
    .modal-card h3 { margin: 0; font-size: 1.15rem; font-weight: 700; }
    
    .target-status-badge {
      display: inline-block;
      margin-top: 0.6rem;
      padding: 0.35rem 0.8rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85rem;
      border: 1px solid transparent;
    }

    .warning-box {
      margin-top: 0.9rem;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      padding: 0.75rem;
      border-radius: 8px;
      font-size: 0.82rem;
      line-height: 1.4;
    }

    .modal-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.4rem; }
    
    .btn.danger {
      background: #ef4444;
      color: #ffffff;
      border-color: #ef4444;
    }
    .btn.danger:hover {
      background: #dc2626;
    }
  `,
})
export class AdminOrdersPage implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  orders = signal<AdminOrder[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  selectedOrderId = signal<number | null>(null);
  
  // Gère la commande en cours de confirmation dans le modal
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

    // Ouvre le modal personnalisé
    this.pendingStatusChange.set({
      order,
      targetStatus,
      selectElement
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
          list.map((o) => (o.id === order.id ? { ...o, status: updatedOrder.status } : o))
        );
        this.pendingStatusChange.set(null);
      },
      error: (err) => {
        if (selectElement) {
          selectElement.value = order.status;
        }
        const msg = apiErrors(err);
        this.errorMessage.set('Erreur lors de la mise à jour: ' + (Array.isArray(msg) ? msg.join(', ') : msg));
        this.pendingStatusChange.set(null);
      },
    });
  }

  getPaymentMethodLabel(method?: string): string {
    switch (method) {
      case 'CASH_ON_DELIVERY': return 'À la livraison';
      case 'PAYPAL': return 'PayPal';
      case 'BANK_TRANSFER': return 'Virement';
      case 'CARD': return 'Carte Bancaire';
      default: return method || '—';
    }
  }

  getPaymentMethodClass(method?: string): string {
    if (method === 'CASH_ON_DELIVERY') {
      return 'pay-cod';
    }
    return 'pay-online';
  }

  getOrderStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'Reçue (En attente)';
      case 'CONFIRMED': return 'Confirmée';
      case 'SHIPPED': return 'Expédiée';
      case 'DELIVERED': return 'Livrée';
      case 'CANCELLED': return 'Annulée';
      default: return status;
    }
  }

  getOrderStatusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'order-status-pending';
      case 'CONFIRMED': return 'order-status-confirmed';
      case 'SHIPPED': return 'order-status-shipped';
      case 'DELIVERED': return 'order-status-delivered';
      case 'CANCELLED': return 'order-status-cancelled';
      default: return '';
    }
  }
}