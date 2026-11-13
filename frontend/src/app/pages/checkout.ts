import { Component, effect, inject, signal } from '@angular/core';
import { Icon } from '../components/icon';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { Address, CartApi } from '../core/cart-api';
import { CartStateService } from '../core/cart.service';
import { SHIPPING_FEE } from '../core/models';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';
import { ProductNamePipe, TPipe, translate } from '../core/i18n';

type PayMethod = 'CARD' | 'PAYPAL' | 'BANK_TRANSFER' | 'CASH_ON_DELIVERY';

const GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan',
  'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir', 'Nabeul',
  'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
];

const cardNumberValid = (c: AbstractControl): ValidationErrors | null => {
  const d = String(c.value ?? '').replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return { card: true };
  let sum = 0;
  let double = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0 ? null : { card: true };
};

const expiryValid = (c: AbstractControl): ValidationErrors | null => {
  const m = /^(\d{2})\/(\d{2})$/.exec(String(c.value ?? ''));
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return { expiry: true };
  return new Date(2000 + Number(m[2]), Number(m[1]), 1) > new Date() ? null : { expiry: true };
};

// Messages traduits à l'affichage
// i18n
const MESSAGES: Record<string, string> = {
  recipientName: 'Indique le nom du destinataire.',
  phone: 'Numéro invalide (8 chiffres, ex. 22 123 456).',
  street: 'Indique ton adresse.',
  governorate: 'Choisis un gouvernorat.',
  city: 'Indique ta ville.',
  postalCode: 'Code postal à 4 chiffres.',
  number: 'Numéro de carte invalide.',
  holder: 'Indique le nom inscrit sur la carte.',
  expiry: 'Date invalide (MM/AA).',
  cvc: 'Code à 3 ou 4 chiffres.',
};
// /i18n

@Component({
  selector: 'app-checkout',
  imports: [Icon, ReactiveFormsModule, RouterLink, TndPipe, TPipe, ProductNamePipe],
  template: `
    <div class="container page">
      <h1>{{ 'Finaliser la commande' | t }}</h1>

      @if (cartState.cart(); as c) {
        @if (!c.items.length) {
          <div class="card empty">
            <p>{{ 'Ton panier est vide.' | t }}</p>
            <a routerLink="/produits" class="btn primary">{{ 'Voir le catalogue' | t }}</a>
          </div>
        } @else {
          <div class="layout">
            <div class="steps">
              <!-- 1. Livraison -->
              <section class="card block">
                <header><span class="num">1</span><h2>{{ 'Livraison' | t }}</h2></header>

                @if (addresses(); as list) {
                  @if (list.length) {
                    <div class="choices">
                      @for (a of list; track a.id) {
                        <label class="choice" [class.on]="!useNew() && selectedId() === a.id">
                          <input type="radio" name="addr" [checked]="!useNew() && selectedId() === a.id" (change)="pickAddress(a.id)" />
                          <span class="body">
                            <strong>{{ a.recipientName }} <span class="tag">{{ a.label | t }}</span></strong>
                            <small class="muted">{{ a.street }}, {{ a.city }}, {{ a.governorate }} {{ a.postalCode }}</small>
                            <small class="muted">{{ a.phone }}</small>
                          </span>
                        </label>
                      }
                      <label class="choice" [class.on]="useNew()">
                        <input type="radio" name="addr" [checked]="useNew()" (change)="useNew.set(true)" />
                        <span class="body"><strong>{{ 'Utiliser une nouvelle adresse' | t }}</strong></span>
                      </label>
                    </div>
                  }
                } @else {
                  <p class="muted">{{ 'Chargement de tes adresses…' | t }}</p>
                }

                @if (useNew()) {
                  <div class="grid" [formGroup]="form">
                    <div class="field s3">
                      <label for="recipientName">{{ 'Nom du destinataire' | t }}</label>
                      <input id="recipientName" formControlName="recipientName" autocomplete="name" />
                      @if (err(form, 'recipientName'); as m) { <small class="err">{{ m }}</small> }
                    </div>
                    <div class="field s3">
                      <label for="phone">{{ 'Téléphone' | t }}</label>
                      <input id="phone" formControlName="phone" inputmode="tel" autocomplete="tel" placeholder="22 123 456" />
                      @if (err(form, 'phone'); as m) { <small class="err">{{ m }}</small> }
                    </div>
                    <div class="field s6">
                      <label for="street">{{ 'Adresse' | t }}</label>
                      <input id="street" formControlName="street" autocomplete="street-address" [placeholder]="'N°, rue, immeuble…' | t" />
                      @if (err(form, 'street'); as m) { <small class="err">{{ m }}</small> }
                    </div>
                    <div class="field s2">
                      <label for="governorate">{{ 'Gouvernorat' | t }}</label>
                      <select id="governorate" formControlName="governorate">
                        <option value="" disabled>{{ 'Choisir…' | t }}</option>
                        @for (g of governorates; track g) { <option [value]="g">{{ g }}</option> }
                      </select>
                      @if (err(form, 'governorate'); as m) { <small class="err">{{ m }}</small> }
                    </div>
                    <div class="field s2">
                      <label for="city">{{ 'Ville' | t }}</label>
                      <input id="city" formControlName="city" autocomplete="address-level2" />
                      @if (err(form, 'city'); as m) { <small class="err">{{ m }}</small> }
                    </div>
                    <div class="field s2">
                      <label for="postalCode">{{ 'Code postal' | t }}</label>
                      <input id="postalCode" formControlName="postalCode" inputmode="numeric" maxlength="4" autocomplete="postal-code" />
                      @if (err(form, 'postalCode'); as m) { <small class="err">{{ m }}</small> }
                    </div>
                    <div class="field s3">
                      <label for="label">{{ 'Enregistrer sous' | t }}</label>
                      <select id="label" formControlName="label">
                        <option value="Domicile">{{ 'Domicile' | t }}</option>
                        <option value="Bureau">{{ 'Bureau' | t }}</option>
                        <option value="Autre">{{ 'Autre' | t }}</option>
                      </select>
                    </div>
                  </div>
                }
              </section>

              <!-- 2. Paiement -->
              <section class="card block">
                <header><span class="num">2</span><h2>{{ 'Paiement' | t }}</h2></header>

                <div class="choices">
                  @for (m of methods; track m.value) {
                    <label class="choice" [class.on]="payment() === m.value">
                      <input type="radio" name="pay" [checked]="payment() === m.value" (change)="payment.set(m.value)" />
                      <span class="body">
                        <strong>{{ m.label | t }}</strong>
                        <small class="muted">{{ m.hint | t }}</small>
                      </span>
                      <span class="brands">
                        @switch (m.value) {
                          @case ('CARD') {
                            <span class="brand visa">VISA</span>
                            <span class="brand mc" aria-label="Mastercard"><i></i><i></i></span>
                          }
                          @case ('PAYPAL') {
                            <span class="brand pp"><b>Pay</b>Pal</span>
                          }
                        }
                      </span>
                    </label>

                    @if (payment() === m.value) {
                      <div class="detail">
                        @switch (m.value) {
                          @case ('CARD') {
                            <div class="grid" [formGroup]="card">
                              <div class="field s6">
                                <label for="cardNumber">{{ 'Numéro de carte' | t }}</label>
                                <input id="cardNumber" formControlName="number" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456" (input)="onNumber($event)" />
                                @if (err(card, 'number'); as e) { <small class="err">{{ e }}</small> }
                              </div>
                              <div class="field s6">
                                <label for="cardHolder">{{ 'Nom sur la carte' | t }}</label>
                                <input id="cardHolder" formControlName="holder" autocomplete="cc-name" />
                                @if (err(card, 'holder'); as e) { <small class="err">{{ e }}</small> }
                              </div>
                              <div class="field s3">
                                <label for="cardExpiry">{{ 'Expiration' | t }}</label>
                                <input id="cardExpiry" formControlName="expiry" inputmode="numeric" autocomplete="cc-exp" [placeholder]="'MM/AA' | t" maxlength="5" (input)="onExpiry($event)" />
                                @if (err(card, 'expiry'); as e) { <small class="err">{{ e }}</small> }
                              </div>
                              <div class="field s3">
                                <label for="cardCvc">{{ 'Code de sécurité' | t }}</label>
                                <input id="cardCvc" formControlName="cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" (input)="onCvc($event)" />
                                @if (err(card, 'cvc'); as e) { <small class="err">{{ e }}</small> }
                              </div>
                            </div>
                            <p class="note">{{ 'Mode démonstration : les informations de carte sont vérifiées dans le navigateur, puis ni envoyées ni enregistrées.' | t }}</p>
                          }
                          @case ('PAYPAL') {
                            <p class="note">{{ 'Tu seras redirigé vers PayPal pour valider le paiement (démonstration : aucune redirection réelle).' | t }}</p>
                          }
                          @case ('BANK_TRANSFER') {
                            <p class="note">{{ 'Les coordonnées bancaires te seront communiquées après validation de la commande. Elle est expédiée à réception du virement.' | t }}</p>
                          }
                          @case ('CASH_ON_DELIVERY') {
                            <p class="note">{{ 'Tu paies en espèces au livreur, à la réception de ton colis.' | t }}</p>
                          }
                        }
                      </div>
                    }
                  }
                </div>
              </section>
            </div>

            <!-- Récapitulatif -->
            <aside class="card summary">
              <h2>{{ 'Récapitulatif' | t }}</h2>
              <ul>
                @for (i of c.items; track i.id) {
                  <li class="summary-item">
                    <div class="summary-item-left">
                      @if (i.product.image?.url) {
                        <img [src]="i.product.image?.url" [alt]="(i.product.image?.altText || i.product.name) | productName" class="summary-thumb" />
                      } @else {
                        <div class="summary-thumb-placeholder"></div>
                      }
                      <span class="summary-product-name">{{ i.product.name | productName }} <small class="muted">× {{ i.quantity }}</small></span>
                    </div>
                    <span class="summary-item-price">{{ i.lineTotal | tnd }}</span>
                  </li>
                }
              </ul>
              <div class="row"><span>{{ 'Sous-total' | t }}</span><span>{{ c.total | tnd }}</span></div>
              <div class="row"><span>{{ 'Livraison' | t }}</span><span>{{ shipping | tnd }}</span></div>
              <div class="row total"><span>{{ 'Total' | t }}</span><span>{{ c.total + shipping | tnd }}</span></div>

              @if (errorMsg()) {
                <div class="alert"><p>{{ errorMsg() }}</p></div>
              }

              <button class="btn primary block" type="button" [disabled]="submitting()" (click)="confirmOrder()">
                {{ (submitting() ? 'Validation…' : 'Confirmer la commande') | t }}
              </button>
              <a routerLink="/panier" class="back"><app-icon name="arrowLeft" [size]="16" /> {{ 'Modifier le panier' | t }}</a>
            </aside>
          </div>
        }
      } @else {
        <p class="muted">{{ 'Chargement…' | t }}</p>
      }
    </div>
  `,
  styles: `
    .page { padding-block: 2rem 3rem; }
    h1 { font-size: var(--fs-3xl); margin-bottom: 1.5rem; }
    .layout { display: grid; gap: 1.5rem; grid-template-columns: 1fr 360px; align-items: start; }
    .steps { display: grid; gap: 1.2rem; }
    .block { padding: 1.5rem; }
    .block header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.1rem; }
    .block h2 { margin: 0; font-size: var(--fs-xl); }
    .num { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-weight: 800; font-size: var(--fs-md); }

    .choices { display: grid; gap: 0.6rem; }
    .choice { display: flex; align-items: center; gap: 0.9rem; padding: 0.9rem 1.1rem; border: 1.5px solid var(--border); border-radius: var(--r-lg); background: var(--bg); transition: border-color 0.15s, background 0.15s; cursor: pointer; }
    .choice:hover { border-color: var(--accent); }
    .choice.on { border-color: var(--accent); background: var(--accent-soft); }
    .choice input { accent-color: var(--accent); width: 18px; height: 18px; flex: none; margin: 0; }
    .body { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0; }
    .body small { font-size: var(--fs-md); }
    .tag { font-size: var(--fs-xs); font-weight: 700; padding: 0.1rem 0.55rem; margin-left: 0.3rem; border-radius: 999px; background: var(--surface-2); color: var(--muted); }

    .brands { display: flex; align-items: center; gap: 0.4rem; }
    .brand { display: inline-flex; align-items: center; justify-content: center; height: 26px; padding: 0 0.6rem; border-radius: 7px; background: #fff; border: 1px solid #dfe5f3; font-size: var(--fs-xs); }
    .visa { color: #1a1f71; font-weight: 800; font-style: italic; letter-spacing: 0.02em; }
    .mc { width: 38px; padding: 0; }
    .mc i { width: 16px; height: 16px; border-radius: 50%; background: #eb001b; }
    .mc i + i { background: #f79e1b; margin-left: -6px; mix-blend-mode: multiply; }
    .pp { color: #009cde; font-weight: 800; font-style: italic; }
    .pp b { color: #003087; }

    .detail { padding: 0.4rem 0.2rem 0.6rem 2.2rem; }
    .note { font-size: var(--fs-md); color: var(--muted); margin: 0.6rem 0 0; }

    .grid { display: grid; gap: 0.2rem 0.9rem; grid-template-columns: repeat(6, 1fr); margin-top: 1rem; }
    .detail .grid { margin-top: 0.4rem; }
    .field { margin-bottom: 0.6rem; }
    .s2 { grid-column: span 2; } .s3 { grid-column: span 3; } .s6 { grid-column: span 6; }
    .field select { padding: 0.7rem 1rem; border-radius: var(--r-md); border: 1px solid var(--border); background-color: var(--bg); color: var(--text); font: inherit; }
    .field select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
    .err { color: var(--red); font-size: var(--fs-sm); }

    /* RÉCAPITULATIF - IMAGES & ARTICLES */
    .summary { padding: 1.5rem; position: sticky; top: 90px; }
    .summary h2 { font-size: var(--fs-xl); margin-bottom: 1rem; }
    .summary ul { list-style: none; padding: 0; margin: 0 0 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
    
    .summary-item { display: flex; justify-content: space-between; align-items: center; gap: 0.8rem; font-size: var(--fs-ui); }
    .summary-item-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
    .summary-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--surface-2); flex-shrink: 0; }
    .summary-thumb-placeholder { width: 44px; height: 44px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); flex-shrink: 0; }
    .summary-product-name { word-break: break-word; line-height: 1.3; }
    .summary-item-price { font-weight: 600; white-space: nowrap; flex-shrink: 0; }

    .row { display: flex; justify-content: space-between; padding: 0.35rem 0; }
    .total { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-xl); border-top: 1px solid var(--border); margin-top: 0.4rem; padding-top: 0.8rem; color: var(--accent); }
    .summary .btn { margin-top: 1rem; }
    .back { display: block; text-align: center; margin-top: 0.9rem; font-size: var(--fs-md); color: var(--muted); }
    .empty { padding: 2.5rem; text-align: center; display: grid; gap: 1rem; justify-items: center; }

    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .summary { position: static; }
      .s2, .s3 { grid-column: span 6; }
      .detail { padding-left: 0; }
    }
  `,
})
export class CheckoutPage {
  private api = inject(CartApi);
  private router = inject(Router);
  private auth = inject(AuthService);
  readonly cartState = inject(CartStateService);

  readonly shipping = SHIPPING_FEE;
  readonly governorates = GOVERNORATES;
  // i18n
  readonly methods: { value: PayMethod; label: string; hint: string }[] = [
    { value: 'CARD', label: 'Carte bancaire', hint: 'Visa, Mastercard' },
    { value: 'PAYPAL', label: 'PayPal', hint: 'Paiement en ligne sécurisé' },
    { value: 'BANK_TRANSFER', label: 'Virement bancaire', hint: 'Expédition après réception du virement' },
    { value: 'CASH_ON_DELIVERY', label: 'Paiement à la livraison', hint: 'Espèces à la réception' },
  ];
  // /i18n

  readonly addresses = signal<Address[] | null>(null);
  readonly selectedId = signal<number | null>(null);
  readonly useNew = signal(false);
  readonly payment = signal<PayMethod>('CASH_ON_DELIVERY');
  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly form = new FormGroup({
    recipientName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^(?:\+?216[\s.-]?)?\d{2}[\s.-]?\d{3}[\s.-]?\d{3}$/)],
    }),
    street: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    governorate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    city: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    postalCode: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{4}$/)] }),
    label: new FormControl('Domicile', { nonNullable: true }),
  });

  readonly card = new FormGroup({
    number: new FormControl('', { nonNullable: true, validators: [cardNumberValid] }),
    holder: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    expiry: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    cvc: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{3,4}$/)] }),
  });

  constructor() {
    effect(() => {
      const u = this.auth.user();
      if (u && !this.form.controls.recipientName.value) {
        this.form.patchValue({ recipientName: `${u.firstName} ${u.lastName}`, phone: u.phone ?? '' });
      }
    });

    this.api.getAddresses().subscribe({
      next: (list) => {
        this.addresses.set(list);
        if (list.length) {
          const defaultAddr = list.find((a) => a.isDefault) ?? list[0];
          this.selectedId.set(defaultAddr.id);
          this.useNew.set(false);
        } else {
          this.useNew.set(true);
        }
      },
      error: () => {
        this.addresses.set([]);
        this.useNew.set(true);
      },
    });
  }

  pickAddress(id: number) {
    this.useNew.set(false);
    this.selectedId.set(id);
  }

  err(group: FormGroup, name: string): string | null {
    const c = group.get(name);
    return c && c.touched && c.invalid ? translate(MESSAGES[name]) : null;
  }

  onNumber(e: Event) {
    const digits = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 19);
    this.card.controls.number.setValue(digits.replace(/(.{4})(?=.)/g, '$1 '));
  }

  onExpiry(e: Event) {
    const d = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
    this.card.controls.expiry.setValue(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
  }

  onCvc(e: Event) {
    this.card.controls.cvc.setValue((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4));
  }

  confirmOrder() {
    this.errorMsg.set(null);

    const address = !this.useNew() && this.selectedId() !== null ? { addressId: this.selectedId()! } : null;
    if (!address) {
      this.form.markAllAsTouched();
      if (this.form.invalid) {
        this.errorMsg.set(translate("Vérifie l'adresse de livraison."));
        return;
      }
    }

    if (this.payment() === 'CARD') {
      this.card.markAllAsTouched();
      if (this.card.invalid) {
        this.errorMsg.set(translate('Vérifie les informations de ta carte.'));
        return;
      }
    }

    this.submitting.set(true);
    this.api
      .checkout({
        ...(address ?? { newAddress: this.form.getRawValue() }),
        paymentMethod: this.payment(),
      })
      .subscribe({
        next: (order) => {
          this.cartState.clearLocal();
          this.router.navigate(['/commandes', order.id]);
        },
        error: (e) => {
          this.submitting.set(false);
          this.errorMsg.set(apiErrors(e).join(' '));
        },
      });
  }
}