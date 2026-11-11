import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { OrdersApiService, type CustomerOrder, type OrderStatus } from '../core/orders-api';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';

@Component({
  standalone: true,
  selector: 'app-account-orders',
  imports: [CommonModule, TndPipe],
  template: `
    <div class="orders-section">
      <div class="card orders-card">
        <div class="orders-card-header">
          <h3>Mes commandes</h3>
          <button class="btn-refresh" (click)="loadOrders()" title="Actualiser les commandes" type="button">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6" />
              <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M2.5 16l1.2 0.8A10 10 0 0 0 22 12.5" />
            </svg>
          </button>
        </div>

        @if (errorMessage()) {
          <div class="alert red" style="margin-block: 0.8rem;">{{ errorMessage() }}</div>
        }

        @if (loadingOrders()) {
          <p class="muted" style="padding-block: 0.5rem;">Chargement de vos commandes...</p>
        } @else if (orders().length === 0) {
          <p class="muted" style="padding-block: 0.5rem;">Vous n'avez pas encore passé de commande.</p>
        } @else {
          <div class="orders-list">
            @for (order of orders(); track order.id) {
              <div class="order-item-card" [class.expanded]="expandedOrderId() === order.id">
                
                <div class="order-item-header" (click)="toggleOrder(order.id)">
                  <div class="order-main">
                    <span class="ref">Réf: <strong>{{ order.reference }}</strong></span>
                    <span class="date">{{ order.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                  <div class="order-meta">
                    <span class="badge-status" [ngClass]="getStatusBadgeClass(order.status)">
                      {{ getStatusLabel(order.status) }}
                    </span>
                    <strong class="total-price">{{ order.total | tnd }}</strong>
                    <button class="chevron-btn" [class.open]="expandedOrderId() === order.id" type="button">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="progress-box">
                  @if (order.status === 'CANCELLED') {
                    <div class="cancelled-banner">Commande annulée</div>
                  } @else {
                    <div class="stepper" [ngClass]="getStepperThemeClass(order.status)">
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

                @if (expandedOrderId() === order.id) {
                  <div class="order-details-pane">
                    <hr class="divider" />
                    <h4 style="margin: 0 0 0.6rem 0;">Articles</h4>
                    <ul class="items-list">
                      @for (item of order.items; track item.id) {
                        <li>
                          <div>
                            <strong>{{ item.productName }}</strong>
                            <br><small class="muted">SKU: {{ item.productSku }} · Qté: {{ item.quantity }}</small>
                          </div>
                          <span class="item-total">{{ item.lineTotal | tnd }}</span>
                        </li>
                      }
                    </ul>
                    <div class="financials">
                      <p>Sous-total: <span>{{ order.subtotal | tnd }}</span></p>
                      <p>Livraison: <span>{{ order.shippingFee | tnd }}</span></p>
                      <p class="final-total">Total TTC: <strong>{{ order.total | tnd }}</strong></p>
                    </div>
                  </div>
                }

              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .orders-section { width: 100%; }
    .orders-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; }
    .orders-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; }
    .orders-card-header h3 { margin: 0; }
    
    .btn-refresh {
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 50%;
      width: 34px; height: 34px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--muted); cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-refresh:hover { color: var(--accent); border-color: var(--accent); background: var(--surface); transform: rotate(45deg); }

    .orders-list { display: flex; flex-direction: column; gap: 0.8rem; }
    .order-item-card {
      background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; transition: border-color 0.2s ease;
    }
    .order-item-card:hover { border-color: var(--accent); }

    .order-item-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
    .order-main { display: flex; flex-direction: column; }
    .ref { font-size: 0.95rem; }
    .date { font-size: 0.8rem; color: var(--muted); }

    .order-meta { display: flex; align-items: center; gap: 0.7rem; }
    .total-price { color: var(--text); }
    
    .chevron-btn {
      background: transparent; border: none; color: var(--muted);
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; padding: 0.2rem;
      transition: transform 0.3s ease, color 0.2s ease;
    }
    .chevron-btn.open { transform: rotate(180deg); color: var(--accent); }

    .progress-box { margin-top: 1rem; padding-top: 0.4rem; }
    .stepper { display: flex; align-items: center; justify-content: space-between; }
    .step { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
    .circle {
      width: 26px; height: 26px; border-radius: 50%; background: var(--surface);
      border: 2px solid var(--border); color: var(--muted);
      display: grid; place-items: center; font-size: 0.75rem; font-weight: 700; transition: all 0.3s ease;
    }
    .step-label { font-size: 0.7rem; color: var(--muted); font-weight: 600; }
    .line { flex: 1; height: 2px; background: var(--border); margin: 0 0.3rem; margin-bottom: 0.9rem; transition: background 0.3s ease; }

    .theme-pending .step.completed .circle { background: #f59e0b; border-color: #f59e0b; color: #fff; }
    .theme-pending .step.completed .step-label { color: #f59e0b; }
    .theme-pending .line.completed { background: #f59e0b; }

    .theme-confirmed .step.completed .circle { background: #3b82f6; border-color: #3b82f6; color: #fff; }
    .theme-confirmed .step.completed .step-label { color: #3b82f6; }
    .theme-confirmed .line.completed { background: #3b82f6; }

    .theme-shipped .step.completed .circle { background: #a855f7; border-color: #a855f7; color: #fff; }
    .theme-shipped .step.completed .step-label { color: #a855f7; }
    .theme-shipped .line.completed { background: #a855f7; }

    .theme-delivered .step.completed .circle { background: #10b981; border-color: #10b981; color: #fff; }
    .theme-delivered .step.completed .step-label { color: #10b981; }
    .theme-delivered .line.completed { background: #10b981; }

    .cancelled-banner { background: rgba(239, 68, 68, 0.12); color: #ef4444; text-align: center; padding: 0.4rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; }

    .badge-status { padding: 0.2rem 0.5rem; border-radius: 99px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
    .badge-pending { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .badge-confirmed { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .badge-shipped { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
    .badge-delivered { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .badge-cancelled { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

    .divider { border: 0; border-top: 1px solid var(--border); margin: 0.8rem 0; }
    .items-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .items-list li { display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; }
    .financials { margin-top: 0.8rem; text-align: right; font-size: 0.85rem; }
    .financials p { margin: 0.2rem 0; color: var(--muted); }
    .financials .final-total { color: var(--accent); font-size: 0.95rem; margin-top: 0.4rem; }
  `
})
export class AccountOrdersPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly ordersApi = inject(OrdersApiService);

  orders = signal<CustomerOrder[]>([]);
  loadingOrders = signal(true);
  errorMessage = signal<string | null>(null);
  expandedOrderId = signal<number | null>(null);

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.loadOrders();
    }
  }

  loadOrders() {
    this.loadingOrders.set(true);
    this.ordersApi.getMyOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loadingOrders.set(false);
      },
      error: (err) => {
        const msg = apiErrors(err);
        this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        this.loadingOrders.set(false);
      }
    });
  }

  toggleOrder(orderId: number) {
    this.expandedOrderId.set(this.expandedOrderId() === orderId ? null : orderId);
  }

  isStepReached(currentStatus: OrderStatus, targetStep: OrderStatus): boolean {
    const steps: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
    const currentIndex = steps.indexOf(currentStatus);
    const targetIndex = steps.indexOf(targetStep);
    return currentIndex >= targetIndex && currentIndex !== -1;
  }

  getStepperThemeClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING': return 'theme-pending';
      case 'CONFIRMED': return 'theme-confirmed';
      case 'SHIPPED': return 'theme-shipped';
      case 'DELIVERED': return 'theme-delivered';
      default: return 'theme-pending';
    }
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