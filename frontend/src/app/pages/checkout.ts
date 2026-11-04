import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartApi, Address } from '../core/cart-api';
import { CartStateService } from '../core/cart.service';
import { TndPipe } from '../core/tnd.pipe';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-checkout-page',
  imports: [FormsModule, TndPipe],
  template: `
    <div class="container page">
      <h2>Passer la commande</h2>

      <div class="checkout-layout">
        <div class="card form-section">
          <h3>1. Adresse de livraison</h3>

          @if (addresses(); as addrList) {
            @if (addrList.length) {
              <div class="addr-selector">
                @for (a of addrList; track a.id) {
                  <label class="addr-card" [class.selected]="selectedAddressId === a.id">
                    <input type="radio" name="address" [value]="a.id" [(ngModel)]="selectedAddressId" />
                    <div>
                      <strong>{{ a.recipientName }}</strong> ({{ a.label }})
                      <p class="muted">{{ a.street }}, {{ a.city }} - {{ a.governorate }} ({{ a.phone }})</p>
                    </div>
                  </label>
                }
              </div>
            }
          }

          <h4 style="margin-top: 1.5rem;">Ou ajouter une nouvelle adresse :</h4>
          <form class="addr-form">
            <div class="row">
              <input type="text" [(ngModel)]="newAddress.recipientName" name="recipientName" placeholder="Nom du destinataire" required />
              <input type="tel" [(ngModel)]="newAddress.phone" name="phone" placeholder="Téléphone" required />
            </div>
            <input type="text" [(ngModel)]="newAddress.street" name="street" placeholder="Adresse rue" required />
            <div class="row">
              <input type="text" [(ngModel)]="newAddress.city" name="city" placeholder="Ville" required />
              <input type="text" [(ngModel)]="newAddress.governorate" name="governorate" placeholder="Gouvernorat" required />
              <input type="text" [(ngModel)]="newAddress.postalCode" name="postalCode" placeholder="Code postal" required />
            </div>
          </form>

          <h3 style="margin-top: 2rem;">2. Mode de paiement</h3>
          <label class="pay-option">
            <input type="radio" name="pay" value="CASH_ON_DELIVERY" checked />
            Paiement à la livraison (Espèces)
          </label>
        </div>

        <div class="card summary">
          <h3>Commande</h3>
          @if (cartState.cart(); as c) {
            <div class="sum-row">
              <span>Articles ({{ c.itemCount }})</span>
              <strong>{{ c.total | tnd }}</strong>
            </div>
            <div class="sum-row">
              <span>Livraison</span>
              <span>7,000 TND</span>
            </div>
            <hr class="divider" />
            <div class="sum-row total">
              <span>Total à payer</span>
              <strong>{{ (c.total + 7) | tnd }}</strong>
            </div>
            <button class="btn primary full" [disabled]="submitting()" (click)="confirmOrder()">
              {{ submitting() ? 'Validation...' : 'Confirmer la commande' }}
            </button>
            @if (errorMsg()) {
              <p class="badge" style="margin-top:0.8rem;">{{ errorMsg() }}</p>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .page { padding-block: 2rem; }
    .checkout-layout { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; margin-top: 1rem; }
    .form-section { padding: 1.5rem; }
    .addr-card { display: flex; gap: 0.8rem; padding: 0.8rem; border: 1px solid var(--border); border-radius: 14px; margin-bottom: 0.6rem; cursor: pointer; }
    .addr-card.selected { border-color: var(--accent); background: var(--surface-2); }
    .addr-form { display: flex; flex-direction: column; gap: 0.8rem; margin-top: 0.8rem; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.8rem; }
    input { padding: 0.6rem; border-radius: 14px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font: inherit; }
    .pay-option { display: flex; gap: 0.6rem; padding: 0.8rem; border: 1px solid var(--border); border-radius: 14px; margin-top: 0.6rem; }
    .summary { padding: 1.5rem; height: fit-content; }
    .sum-row { display: flex; justify-content: space-between; margin-bottom: 0.8rem; }
    .sum-row.total { font-size: 1.2rem; color: var(--accent); }
    .divider { border: 0; border-top: 1px solid var(--border); margin-block: 1rem; }
    .full { width: 100%; margin-top: 1rem; }
    @media (max-width: 800px) { .checkout-layout { grid-template-columns: 1fr; } }
  `,
})
export class CheckoutPage {
  private api = inject(CartApi);
  readonly cartState = inject(CartStateService);
  private router = inject(Router);

  readonly addresses = toSignal(this.api.getAddresses(), { initialValue: [] as Address[] });
  selectedAddressId: number | null = null;

  newAddress = {
    label: 'Domicile',
    recipientName: '',
    phone: '',
    street: '',
    city: '',
    governorate: '',
    postalCode: '',
  };

  submitting = signal(false);
  errorMsg = signal<string | null>(null);

  confirmOrder() {
    this.submitting.set(true);
    this.errorMsg.set(null);

    const payload = this.selectedAddressId
      ? { addressId: this.selectedAddressId }
      : { newAddress: this.newAddress };

    this.api.checkout(payload).subscribe({
      next: (order) => {
        this.cartState.clearLocal();
        this.router.navigate(['/commandes', order.id]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMsg.set(err.error?.message || 'Erreur lors de la commande');
      },
    });
  }
}
