import { Component, inject, signal, OnInit } from '@angular/core';
import { Icon } from '../components/icon';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { OrdersApiService, type CustomerOrder, type OrderStatus } from '../core/orders-api';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';
import { ProductNamePipe, TPipe } from '../core/i18n';

@Component({
  standalone: true,
  selector: 'app-account-orders',
  imports: [Icon, CommonModule, TndPipe, TPipe, ProductNamePipe],
  template: `
    <div class="orders-section">
      <div class="card orders-card">
        <div class="orders-card-header">
          <h3>{{ 'Mes commandes' | t }}</h3>
          <button class="btn-refresh" (click)="loadOrders()" [title]="'Actualiser les commandes' | t" type="button">
            <app-icon name="refresh" [size]="16" />
          </button>
        </div>

        @if (errorMessage()) {
          <div class="alert red" style="margin-block: 0.8rem;">{{ errorMessage() }}</div>
        }

        @if (loadingOrders()) {
          <p class="muted" style="padding-block: 0.5rem;">{{ 'Chargement de vos commandes...' | t }}</p>
        } @else if (orders().length === 0) {
          <p class="muted" style="padding-block: 0.5rem;">{{ "Vous n'avez pas encore passé de commande." | t }}</p>
        } @else {
          <div class="orders-list">
            @for (order of orders(); track order.id) {
              <div class="order-item-card" [class.expanded]="expandedOrderId() === order.id">
                
                <div class="order-item-header" (click)="toggleOrder(order.id)">
                  <div class="order-main">
                    <span class="ref">{{ 'Réf:' | t }} <strong>{{ order.reference }}</strong></span>
                    <span class="date">{{ order.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                  <div class="order-meta">
                    <span class="badge-status" [ngClass]="getStatusBadgeClass(order.status)">
                      {{ getStatusLabel(order.status) | t }}
                    </span>
                    <strong class="total-price">{{ order.total | tnd }}</strong>
                    <button class="chevron-btn" [class.open]="expandedOrderId() === order.id" type="button">
                      <app-icon name="chevronDown" [size]="16" [stroke]="2" />
                    </button>
                  </div>
                </div>

                <div class="progress-box">
                  @if (order.status === 'CANCELLED') {
                    <div class="cancelled-banner">{{ 'Commande annulée' | t }}</div>
                  } @else {
                    <div class="stepper" [ngClass]="getStepperThemeClass(order.status)">
                      <div class="step" [class.completed]="isStepReached(order.status, 'PENDING')">
                        <div class="circle">1</div>
                        <span class="step-label">{{ 'Reçue' | t }}</span>
                      </div>
                      <div class="line" [class.completed]="isStepReached(order.status, 'CONFIRMED')"></div>

                      <div class="step" [class.completed]="isStepReached(order.status, 'CONFIRMED')">
                        <div class="circle">2</div>
                        <span class="step-label">{{ 'Confirmée' | t }}</span>
                      </div>
                      <div class="line" [class.completed]="isStepReached(order.status, 'SHIPPED')"></div>

                      <div class="step" [class.completed]="isStepReached(order.status, 'SHIPPED')">
                        <div class="circle">3</div>
                        <span class="step-label">{{ 'Expédiée' | t }}</span>
                      </div>
                      <div class="line" [class.completed]="isStepReached(order.status, 'DELIVERED')"></div>

                      <div class="step" [class.completed]="isStepReached(order.status, 'DELIVERED')">
                        <div class="circle">4</div>
                        <span class="step-label">{{ 'Livrée' | t }}</span>
                      </div>
                    </div>
                  }
                </div>

                @if (expandedOrderId() === order.id) {
                  <div class="order-details-pane">
                    <hr class="divider" />
                    <h4 style="margin: 0 0 0.6rem 0;">{{ 'Articles' | t }}</h4>
                    <ul class="items-list">
                      @for (item of order.items; track item.id) {
                        <li>
                          <div>
                            <strong>{{ item.productName | productName }}</strong>
                            <br><small class="muted">{{ 'SKU : {sku} · Qté : {qty}' | t: { sku: item.productSku, qty: item.quantity } }}</small>
                          </div>
                          <span class="item-total">{{ item.lineTotal | tnd }}</span>
                        </li>
                      }
                    </ul>
                    <div class="financials">
                      <p>{{ 'Sous-total :' | t }} <span>{{ order.subtotal | tnd }}</span></p>
                      <p>{{ 'Livraison :' | t }} <span>{{ order.shippingFee | tnd }}</span></p>
                      <p class="final-total">{{ 'Total TTC :' | t }} <strong>{{ order.total | tnd }}</strong></p>
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
    .orders-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 1.2rem; }
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
      background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 1rem; transition: border-color 0.2s ease;
    }
    .order-item-card:hover { border-color: var(--accent); }

    .order-item-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
    .order-main { display: flex; flex-direction: column; }
    .ref { font-size: var(--fs-ui); }
    .date { font-size: var(--fs-sm); color: var(--muted); }

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
      display: grid; place-items: center; font-size: var(--fs-xs); font-weight: 700; transition: all 0.3s ease;
    }
    .step-label { font-size: var(--fs-2xs); color: var(--muted); font-weight: 600; }
    .line { flex: 1; height: 2px; background: var(--border); margin: 0 0.3rem; margin-bottom: 0.9rem; transition: background 0.3s ease; }

    .theme-pending .step.completed .circle { background: var(--warn); border-color: var(--warn); color: #fff; }
    .theme-pending .step.completed .step-label { color: var(--warn); }
    .theme-pending .line.completed { background: var(--warn); }

    .theme-confirmed .step.completed .circle { background: var(--info); border-color: var(--info); color: #fff; }
    .theme-confirmed .step.completed .step-label { color: var(--info); }
    .theme-confirmed .line.completed { background: var(--info); }

    .theme-shipped .step.completed .circle { background: var(--violet); border-color: var(--violet); color: #fff; }
    .theme-shipped .step.completed .step-label { color: var(--violet); }
    .theme-shipped .line.completed { background: var(--violet); }

    .theme-delivered .step.completed .circle { background: var(--green); border-color: var(--green); color: #fff; }
    .theme-delivered .step.completed .step-label { color: var(--green); }
    .theme-delivered .line.completed { background: var(--green); }

    .cancelled-banner { background: color-mix(in srgb, var(--red) 12%, transparent); color: var(--red); text-align: center; padding: 0.4rem; border-radius: var(--r-sm); font-size: var(--fs-md); font-weight: 600; }

    .badge-status { padding: 0.2rem 0.5rem; border-radius: 99px; font-size: var(--fs-2xs); font-weight: 700; text-transform: uppercase; }
    .badge-pending { background: color-mix(in srgb, var(--warn) 15%, transparent); color: var(--warn); }
    .badge-confirmed { background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); }
    .badge-shipped { background: color-mix(in srgb, var(--violet) 15%, transparent); color: var(--violet); }
    .badge-delivered { background: color-mix(in srgb, var(--green) 15%, transparent); color: var(--green); }
    .badge-cancelled { background: color-mix(in srgb, var(--red) 15%, transparent); color: var(--red); }

    .divider { border: 0; border-top: 1px solid var(--border); margin: 0.8rem 0; }
    .items-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .items-list li { display: flex; justify-content: space-between; align-items: center; font-size: var(--fs-md); }
    .financials { margin-top: 0.8rem; text-align: right; font-size: var(--fs-md); }
    .financials p { margin: 0.2rem 0; color: var(--muted); }
    .financials .final-total { color: var(--accent); font-size: var(--fs-ui); margin-top: 0.4rem; }
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
    // « En préparation » s'affiche au même niveau que « Confirmée » sur la frise
    const currentIndex = steps.indexOf(currentStatus === 'PREPARING' ? 'CONFIRMED' : currentStatus);
    const targetIndex = steps.indexOf(targetStep);
    return currentIndex >= targetIndex && currentIndex !== -1;
  }

  getStepperThemeClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING': return 'theme-pending';
      case 'CONFIRMED':
      case 'PREPARING': return 'theme-confirmed';
      case 'SHIPPED': return 'theme-shipped';
      case 'DELIVERED': return 'theme-delivered';
      default: return 'theme-pending';
    }
  }

  /** Libellé du statut en français (traduit à l'affichage) */
  getStatusLabel(status: OrderStatus): string {
    // i18n
    switch (status) {
      case 'PENDING': return 'En attente';
      case 'CONFIRMED': return 'Confirmée';
      case 'PREPARING': return 'En préparation';
      case 'SHIPPED': return 'Expédiée';
      case 'DELIVERED': return 'Livrée';
      case 'CANCELLED': return 'Annulée';
      default: return status;
    }
    // /i18n
  }

  getStatusBadgeClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING': return 'badge-pending';
      case 'CONFIRMED':
      case 'PREPARING': return 'badge-confirmed';
      case 'SHIPPED': return 'badge-shipped';
      case 'DELIVERED': return 'badge-delivered';
      case 'CANCELLED': return 'badge-cancelled';
      default: return '';
    }
  }
}