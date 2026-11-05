import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrdersApiService, type CustomerOrder, type OrderStatus } from '../core/orders-api';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';

@Component({
  standalone: true,
  selector: 'app-customer-orders',
  imports: [CommonModule, TndPipe],
  template: `
    <div class="container section">
      <div class="header-title">
        <h1>Mes Commandes</h1>
        <p class="muted">Suivez l'état de vos achats et consultez l'historique complet.</p>
      </div>

      @if (errorMessage()) {
        <div class="alert red" style="margin-bottom: 1.5rem;">{{ errorMessage() }}</div>
      }

      @if (loading()) {
        <div class="loading-state">
          <p>Chargement de vos commandes...</p>
        </div>
      } @else if (orders().length === 0) {
        <div class="empty-card card">
          <div class="empty-icon">📦</div>
          <h3>Aucune commande pour le moment</h3>
          <p class="muted">Vous n'avez pas encore passé de commande sur ByteBazaar.</p>
        </div>
      } @else {
        <div class="orders-list">
          @for (order of orders(); track order.id) {
            <div class="card order-card" [class.expanded]="expandedOrderId() === order.id">
              
              <!-- En-tête de la commande -->
              <div class="order-header" (click)="toggleOrder(order.id)">
                <div class="order-main-info">
                  <span class="order-ref">Réf: <strong>{{ order.reference }}</strong></span>
                  <span class="order-date">{{ order.createdAt | date:'dd/MM/yyyy à HH:mm' }}</span>
                </div>

                <div class="order-summary-meta">
                  <span class="badge-status" [ngClass]="getStatusBadgeClass(order.status)">
                    {{ getStatusLabel(order.status) }}
                  </span>
                  <span class="order-total"><strong>{{ order.total | tnd }}</strong></span>
                  <span class="chevron" [class.open]="expandedOrderId() === order.id">▼</span>
                </div>
              </div>

              <!-- Barre de progression -->
              <div class="progress-container">
                @if (order.status === 'CANCELLED') {
                  <div class="cancelled-bar">
                    ❌ Cette commande a été annulée.
                  </div>
                } @else {
                  <div class="stepper">
                    <div class="step" [class.completed]="isStepReached(order.status, 'PENDING')">
                      <div class="circle">1</div>
                      <span class="step-label">Reçue</span>
                    </div>
                    <div class="line" [class.completed]="isStepReached(order.status, 'CONFIRMED')"></div>

                    <div class="step" [class.completed]="isStepReached(order.status, 'CONFIRMED')">
                      <div class="circle">2</div>
                      <span class="step-label">Confirmée</span>
                    </div>
                    <div class="line" [class.completed]="isStepReached(order.status, 'SHIPPED')"></div>

                    <div class="step" [class.completed]="isStepReached(order.status, 'SHIPPED')">
                      <div class="circle">3</div>
                      <span class="step-label">Expédiée</span>
                    </div>
                    <div class="line" [class.completed]="isStepReached(order.status, 'DELIVERED')"></div>

                    <div class="step" [class.completed]="isStepReached(order.status, 'DELIVERED')">
                      <div class="circle">4</div>
                      <span class="step-label">Livrée</span>
                    </div>
                  </div>
                }
              </div>

              <!-- Détails des articles (Affichables au clic) -->
              @if (expandedOrderId() === order.id) {
                <div class="order-details">
                  <hr class="divider" />
                  <h4>Articles commandés</h4>
                  
                  <div class="items-table-wrapper">
                    <table class="items-table">
                      <thead>
                        <tr>
                          <th>Produit</th>
                          <th>Prix Unitaire</th>
                          <th>Quantité</th>
                          <th style="text-align: right;">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of order.items; track item.id) {
                          <tr>
                            <td>
                              <strong>{{ item.productName }}</strong><br>
                              <small class="muted">SKU: {{ item.productSku }}</small>
                            </td>
                            <td>{{ item.unitPrice | tnd }}</td>
                            <td>x{{ item.quantity }}</td>
                            <td style="text-align: right;"><strong>{{ item.lineTotal | tnd }}</strong></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  <div class="order-financials">
                    <div class="financial-row">
                      <span>Sous-total:</span>
                      <span>{{ order.subtotal | tnd }}</span>
                    </div>
                    <div class="financial-row">
                      <span>Frais de livraison:</span>
                      <span>{{ order.shippingFee | tnd }}</span>
                    </div>
                    <div class="financial-row total">
                      <span>Total TTC:</span>
                      <strong>{{ order.total | tnd }}</strong>
                    </div>
                  </div>
                </div>
              }

            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .header-title { margin-bottom: 2rem; }
    .orders-list { display: flex; flex-direction: column; gap: 1.5rem; }
    
    .order-card {
      padding: 1.5rem;
      border-radius: 16px;
      transition: all 0.3s ease;
    }

    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }
    .order-main-info { display: flex; flex-direction: column; gap: 0.2rem; }
    .order-ref { font-size: 1.1rem; }
    .order-date { font-size: 0.85rem; color: var(--muted); }

    .order-summary-meta {
      display: flex;
      align-items: center;
      gap: 1.2rem;
    }
    .order-total { font-size: 1.15rem; color: var(--accent); }

    .chevron {
      font-size: 0.8rem;
      transition: transform 0.3s ease;
      color: var(--muted);
    }
    .chevron.open { transform: rotate(180deg); }

    /* --- BARRE DE PROGRESSION --- */
    .progress-container {
      margin-top: 1.5rem;
      padding: 1rem 0.5rem;
    }
    .stepper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      position: relative;
      z-index: 2;
    }
    .circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--surface-2);
      border: 2px solid var(--border);
      color: var(--muted);
      display: grid;
      place-items: center;
      font-size: 0.85rem;
      font-weight: 700;
      transition: all 0.3s ease;
    }
    .step-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--muted);
      transition: color 0.3s ease;
    }
    .line {
      flex: 1;
      height: 3px;
      background: var(--border);
      margin: 0 0.5rem;
      margin-bottom: 1.4rem;
      transition: background 0.3s ease;
    }

    /* État complété des étapes */
    .step.completed .circle {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--on-accent);
      box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 50%, transparent);
    }
    .step.completed .step-label { color: var(--text); }
    .line.completed { background: var(--accent); }

    .cancelled-bar {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.9rem;
      text-align: center;
    }

    /* --- BADGES --- */
    .badge-status {
      padding: 0.35rem 0.8rem;
      border-radius: 99px;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-pending { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-confirmed { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
    .badge-shipped { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }
    .badge-delivered { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-cancelled { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }

    /* --- DÉTAILS & FINANCIALS --- */
    .divider { border: 0; border-top: 1px solid var(--border); margin: 1.5rem 0; }
    .items-table-wrapper { overflow-x: auto; margin-top: 1rem; }
    .items-table { width: 100%; border-collapse: collapse; text-align: left; }
    .items-table th, .items-table td { padding: 0.75rem; border-bottom: 1px solid var(--border); }
    
    .order-financials {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
      margin-top: 1.5rem;
    }
    .financial-row { display: flex; gap: 2rem; font-size: 0.95rem; }
    .financial-row.total { font-size: 1.15rem; color: var(--accent); margin-top: 0.4rem; }

    .empty-card { text-align: center; padding: 4rem 2rem; }
    .empty-icon { font-size: 3rem; margin-bottom: 1rem; }
  `]
})
export class CustomerOrdersPage implements OnInit {
  private readonly ordersApi = inject(OrdersApiService);

  orders = signal<CustomerOrder[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  expandedOrderId = signal<number | null>(null);

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading.set(true);
    this.ordersApi.getMyOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = apiErrors(err);
        this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        this.loading.set(false);
      }
    });
  }

  toggleOrder(orderId: number) {
    this.expandedOrderId.set(this.expandedOrderId() === orderId ? null : orderId);
  }

  isStepReached(currentStatus: OrderStatus, targetStep: OrderStatus): boolean {
    const order: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
    const currentIndex = order.indexOf(currentStatus);
    const targetIndex = order.indexOf(targetStep);
    return currentIndex >= targetIndex && currentIndex !== -1;
  }

  getStatusLabel(status: OrderStatus): string {
    switch (status) {
      case 'PENDING': return 'En attente';
      case 'CONFIRMED': return 'Confirmée';
      case 'SHIPPED': return 'Expédiée';
      case 'DELIVERED': return 'Livrée';
      case 'CANCELLED': return 'Annulée';
      default: return status;
    }
  }

  getStatusBadgeClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING': return 'badge-pending';
      case 'CONFIRMED': return 'badge-confirmed';
      case 'SHIPPED': return 'badge-shipped';
      case 'DELIVERED': return 'badge-delivered';
      case 'CANCELLED': return 'badge-cancelled';
      default: return '';
    }
  }
}