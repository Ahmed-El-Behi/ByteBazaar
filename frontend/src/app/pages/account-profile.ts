import { Component, inject, signal, HostListener, effect } from '@angular/core';
import { Icon } from '../components/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth-service';
import { CartApi, Address } from '../core/cart-api';
import { ComponentCanDeactivate } from '../core/pending-changes.guard';
import { apiErrors } from '../core/utils';
import { TPipe, translate } from '../core/i18n';

@Component({
  standalone: true,
  selector: 'app-account-profile',
  imports: [Icon, CommonModule, FormsModule, TPipe],
  template: `
    <div class="profile-wrapper">
      @if (successMessage()) {
        <div class="alert-success">{{ successMessage() }}</div>
      }
      @if (errorMessage()) {
        <div class="alert-danger">{{ errorMessage() }}</div>
      }

      @if (hasUnsavedChanges()) {
        <div class="warning-banner">
          <div class="warning-info">
            <app-icon name="info" [size]="18" />
            <span>{{ 'Vous avez des modifications non enregistrées.' | t }}</span>
          </div>
          <div class="warning-btns">
            <button
              type="button"
              class="btn small"
              (click)="cancelChanges()"
              [disabled]="isSaving()"
            >
              {{ 'Annuler' | t }}
            </button>
            <button
              type="button"
              class="btn primary small"
              (click)="onSaveProfile()"
              [disabled]="isSaving()"
            >
              {{ (isSaving() ? 'Enregistrement...' : 'Enregistrer') | t }}
            </button>
          </div>
        </div>
      }

      <section class="card">
        <h2 class="card-title">{{ 'Informations personnelles' | t }}</h2>

        <form (ngSubmit)="onSaveProfile()" class="form-layout">
          <div class="grid-2">
            <div class="field">
              <label>{{ 'Prénom' | t }}</label>
              <input
                type="text"
                [(ngModel)]="userForm.firstName"
                name="firstName"
                (ngModelChange)="onFormChange()"
                class="input-tech"
              />
            </div>

            <div class="field">
              <label>{{ 'Nom' | t }}</label>
              <input
                type="text"
                [(ngModel)]="userForm.lastName"
                name="lastName"
                (ngModelChange)="onFormChange()"
                class="input-tech"
              />
            </div>

            <div class="field">
              <label>{{ 'Email (Non modifiable)' | t }}</label>
              <input type="email" [value]="userForm.email" disabled class="input-tech disabled" />
            </div>

            <div class="field">
              <label>{{ 'Téléphone' | t }}</label>
              <input
                type="tel"
                [(ngModel)]="userForm.phone"
                name="phone"
                (ngModelChange)="onFormChange()"
                class="input-tech"
              />
            </div>
          </div>

          <div class="password-box">
            <h3 class="sub-title">{{ 'Changer le mot de passe' | t }}</h3>

            <div class="grid-2">
              <div class="field">
                <label>{{ 'Mot de passe actuel' | t }}</label>
                <div class="input-pass-wrapper">
                  <input
                    [type]="showCurrentPass() ? 'text' : 'password'"
                    [(ngModel)]="userForm.currentPassword"
                    name="currentPassword"
                    (ngModelChange)="onFormChange()"
                    placeholder="••••••••••••"
                    class="input-tech"
                  />
                  <button
                    type="button"
                    class="eye-btn"
                    (click)="showCurrentPass.set(!showCurrentPass())"
                  >
                    @if (showCurrentPass()) {
                      <app-icon name="eyeOff" [size]="18" />
                    } @else {
                      <app-icon name="eye" [size]="18" />
                    }
                  </button>
                </div>
              </div>

              <div class="field">
                <label>{{ 'Nouveau mot de passe' | t }}</label>
                <div class="input-pass-wrapper">
                  <input
                    [type]="showNewPass() ? 'text' : 'password'"
                    [(ngModel)]="userForm.newPassword"
                    name="newPassword"
                    (ngModelChange)="onFormChange()"
                    [placeholder]="'Au moins 8 caractères' | t"
                    class="input-tech"
                  />
                  <button type="button" class="eye-btn" (click)="showNewPass.set(!showNewPass())">
                    @if (showNewPass()) {
                      <app-icon name="eyeOff" [size]="18" />
                    } @else {
                      <app-icon name="eye" [size]="18" />
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-footer">
            <button
              type="submit"
              class="btn primary small"
              [disabled]="!hasUnsavedChanges() || isSaving()"
            >
              {{ (isSaving() ? 'Enregistrement...' : 'Enregistrer les modifications') | t }}
            </button>
          </div>
        </form>
      </section>

      <section class="card">
        <div class="card-header">
          <h2 class="card-title">{{ 'Mes adresses de livraison' | t }}</h2>
          <button type="button" class="btn small" (click)="onAddAddress()">
            {{ (showAddressForm() ? 'Annuler' : '+ Ajouter une adresse') | t }}
          </button>
        </div>

        @if (showAddressForm()) {
          <form (ngSubmit)="saveNewAddress()" class="address-form-box">
            <div class="field">
              <label>{{ 'Adresse' | t }}</label>
              <input
                type="text"
                [(ngModel)]="newAddressForm.street"
                name="addrStreet"
                [placeholder]="'N°, rue, immeuble…' | t"
                class="input-tech"
                required
              />
            </div>

            <div class="grid-3">
              <div class="field">
                <label>{{ 'Gouvernorat' | t }}</label>
                <select
                  [(ngModel)]="newAddressForm.governorate"
                  name="addrGov"
                  class="input-tech"
                  required
                >
                  <option value="" disabled selected>{{ 'Choisir…' | t }}</option>
                  @for (gov of governorates; track gov) {
                    <option [value]="gov">{{ gov }}</option>
                  }
                </select>
              </div>

              <div class="field">
                <label>{{ 'Ville' | t }}</label>
                <input
                  type="text"
                  [(ngModel)]="newAddressForm.city"
                  name="addrCity"
                  [placeholder]="'Ex : Tunis' | t"
                  class="input-tech"
                  required
                />
              </div>

              <div class="field">
                <label>{{ 'Code postal' | t }}</label>
                <input
                  type="text"
                  [(ngModel)]="newAddressForm.postalCode"
                  name="addrZip"
                  [placeholder]="'Ex : 1000' | t"
                  class="input-tech"
                  required
                />
              </div>
            </div>

            <div class="grid-3">
              <div class="field">
                <label>{{ 'Enregistrer sous' | t }}</label>
                <select
                  [(ngModel)]="newAddressForm.label"
                  name="addrLabel"
                  class="input-tech"
                  required
                >
                  <option value="Domicile">{{ 'Domicile' | t }}</option>
                  <option value="Bureau">{{ 'Bureau' | t }}</option>
                  <option value="Autre">{{ 'Autre' | t }}</option>
                </select>
              </div>
            </div>

            <div class="address-form-actions">
              <button type="button" class="btn small" (click)="showAddressForm.set(false)">
                {{ 'Annuler' | t }}
              </button>
              <button type="submit" class="btn primary small">
                {{ "Enregistrer l'adresse" | t }}
              </button>
            </div>
          </form>
        }

        <div class="address-grid">
          @for (addr of addresses(); track addr.id) {
            <div
              class="address-card"
              [class.active]="addr.isDefault"
              (click)="setDefaultAddress(addr.id)"
            >
              <button
                type="button"
                class="btn-delete"
                [title]="'Supprimer cette adresse' | t"
                (click)="deleteAddress(addr.id, $event)"
              >
                &times;
              </button>

              <div class="address-top">
                <input
                  type="radio"
                  name="defaultAddress"
                  [checked]="addr.isDefault"
                  class="radio-tech"
                />
                <span class="addr-title">{{ addr.recipientName }}</span>
                <span class="badge-label">{{ addr.label | t }}</span>
                @if (addr.isDefault) {
                  <span class="badge-accent">{{ 'Par défaut' | t }}</span>
                }
              </div>
              <p class="addr-details">{{ addr.street }}</p>
              <p class="addr-details">
                {{ addr.city }}, {{ addr.governorate }} {{ addr.postalCode }}
              </p>
              @if (addr.phone) {
                <p class="addr-details phone">{{ addr.phone }}</p>
              }
            </div>
          } @empty {
            @if (!showAddressForm()) {
              <p class="muted">{{ 'Aucune adresse enregistrée pour le moment.' | t }}</p>
            }
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .profile-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .alert-success {
      background: color-mix(in srgb, var(--green) 15%, transparent);
      border: 1px solid var(--green);
      color: var(--green);
      padding: 0.8rem 1.2rem;
      border-radius: var(--r-md);
      font-size: var(--fs-md);
    }
    .alert-danger {
      background: color-mix(in srgb, var(--red) 15%, transparent);
      border: 1px solid var(--red);
      color: var(--red);
      padding: 0.8rem 1.2rem;
      border-radius: var(--r-md);
      font-size: var(--fs-md);
    }

    .warning-banner {
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      border: 1px solid var(--accent);
      border-radius: var(--r-md);
      padding: 0.8rem 1.2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      color: var(--accent);
    }
    .warning-info {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: var(--fs-md);
      font-weight: 500;
    }
    .warning-btns {
      display: flex;
      gap: 0.5rem;
    }

    .card {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: 1.5rem;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
    }
    .card-title {
      font-size: var(--fs-xl);
      font-weight: 500;
      color: var(--text);
      margin: 0 0 1.2rem 0;
    }
    .card-header .card-title {
      margin: 0;
    }

    .form-layout {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .field label {
      font-size: var(--fs-md);
      color: var(--muted);
      font-weight: 400;
    }

    .input-tech {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r-sm);
      padding: 0.75rem 1rem;
      color: var(--text);
      font-size: var(--fs-ui);
      outline: none;
      transition: border-color 0.2s ease;
    }
    .input-tech:focus {
      border-color: var(--accent);
    }
    .input-tech.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    select.input-tech option {
      background: var(--surface);
      color: #fff;
    }

    .password-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .sub-title {
      font-size: var(--fs-ui);
      color: var(--text);
      font-weight: 500;
      margin: 0;
    }

    .input-pass-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-pass-wrapper input {
      width: 100%;
      padding-right: 2.8rem;
    }
    .eye-btn {
      position: absolute;
      right: 0.8rem;
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .eye-btn:hover {
      color: var(--text);
    }

    .address-form-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .address-form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.8rem;
      margin-top: 0.5rem;
    }

    .form-footer {
      display: flex;
      justify-content: flex-end;
    }

    .address-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .address-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      position: relative;
    }
    .address-card.active {
      border-color: var(--accent);
    }

    .btn-delete {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--red);
      color: #ffffff;
      border: 2px solid var(--surface-2, var(--surface));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--fs-base);
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      opacity: 0;
      transform: scale(0.8);
      transition:
        opacity 0.2s ease,
        transform 0.2s ease,
        background 0.2s ease;
      z-index: 10;
    }

    .address-card:hover .btn-delete {
      opacity: 1;
      transform: scale(1);
    }

    .btn-delete:hover {
      background: var(--red);
      transform: scale(1.1);
    }

    .address-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-right: 1rem;
    }
    .radio-tech {
      accent-color: var(--accent);
      cursor: pointer;
    }
    .addr-title {
      font-weight: 600;
      color: var(--text);
      font-size: var(--fs-ui);
    }
    .badge-label {
      font-size: var(--fs-xs);
      font-weight: 700;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--muted);
    }
    .badge-accent {
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent);
      font-size: var(--fs-2xs);
      font-weight: 500;
      padding: 0.15rem 0.5rem;
      border-radius: 99px;
      margin-left: auto;
    }
    .addr-details {
      font-size: var(--fs-md);
      color: var(--muted);
      margin: 0;
      padding-left: 1.5rem;
    }
    .addr-details.phone {
      opacity: 0.8;
    }
    .muted {
      color: var(--muted);
      font-size: var(--fs-md);
    }
  `,
})
export class AccountProfilePage implements ComponentCanDeactivate {
  readonly auth = inject(AuthService);
  private cartApi = inject(CartApi);

  showCurrentPass = signal(false);
  showNewPass = signal(false);
  hasUnsavedChanges = signal(false);
  isSaving = signal(false);
  showAddressForm = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  governorates: string[] = [
    'Ariana',
    'Béja',
    'Ben Arous',
    'Bizerte',
    'Gabès',
    'Gafsa',
    'Jendouba',
    'Kairouan',
    'Kasserine',
    'Kébili',
    'Le Kef',
    'Mahdia',
    'La Manouba',
    'Médenine',
    'Monastir',
    'Nabeul',
    'Sfax',
    'Sidi Bouzid',
    'Siliana',
    'Sousse',
    'Tataouine',
    'Tozeur',
    'Tunis',
    'Zaghouan',
  ];

  newAddressForm = {
    street: '',
    governorate: '',
    city: '',
    postalCode: '',
    label: 'Domicile',
  };

  userForm = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
  };

  private initialForm = { ...this.userForm };
  addresses = signal<Address[]>([]);

  constructor() {
    effect(() => {
      const u = this.auth.user();
      if (u) {
        this.userForm.firstName = u.firstName || '';
        this.userForm.lastName = u.lastName || '';
        this.userForm.email = u.email || '';
        this.userForm.phone = u.phone || '';
        this.initialForm = { ...this.userForm };
      }
    });

    this.loadAddresses();
  }

  loadAddresses() {
    this.cartApi.getAddresses().subscribe({
      next: (list) => this.addresses.set(list),
      error: () => this.addresses.set([]),
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    if (this.hasUnsavedChanges()) {
      $event.returnValue = true;
    }
  }

  canDeactivate(): boolean {
    return !this.hasUnsavedChanges();
  }

  onFormChange() {
    this.hasUnsavedChanges.set(
      this.userForm.firstName !== this.initialForm.firstName ||
        this.userForm.lastName !== this.initialForm.lastName ||
        this.userForm.phone !== this.initialForm.phone ||
        this.userForm.currentPassword !== '' ||
        this.userForm.newPassword !== '',
    );
  }

  cancelChanges() {
    this.userForm = { ...this.initialForm, currentPassword: '', newPassword: '' };
    this.hasUnsavedChanges.set(false);
    this.errorMessage.set(null);
  }

  onAddAddress() {
    this.showAddressForm.update((v) => !v);
  }

  saveNewAddress() {
    if (
      !this.newAddressForm.street ||
      !this.newAddressForm.city ||
      !this.newAddressForm.postalCode ||
      !this.newAddressForm.governorate
    ) {
      return;
    }

    const u = this.auth.user();
    const payload = {
      recipientName: u ? `${u.firstName} ${u.lastName}`.trim() : 'Client',
      phone: u?.phone || '',
      street: this.newAddressForm.street,
      governorate: this.newAddressForm.governorate,
      city: this.newAddressForm.city,
      postalCode: this.newAddressForm.postalCode,
      label: this.newAddressForm.label,
    };

    this.cartApi.createAddress(payload).subscribe({
      next: (newAddr) => {
        this.addresses.update((list) => [...list, newAddr]);
        this.newAddressForm = {
          street: '',
          governorate: '',
          city: '',
          postalCode: '',
          label: 'Domicile',
        };
        this.showAddressForm.set(false);
      },
      error: (err) => this.errorMessage.set(apiErrors(err).join(' ')),
    });
  }

  // Mise à jour immédiate de l'affichage, puis liste renvoyée par le serveur (rechargée en cas d'échec)
  deleteAddress(id: number, event: Event) {
    event.stopPropagation();
    this.addresses.update((list) => list.filter((addr) => addr.id !== id));
    this.cartApi.deleteAddress(id).subscribe({
      next: (list) => this.addresses.set(list),
      error: (err) => this.onAddressError(err),
    });
  }

  setDefaultAddress(selectedId: number) {
    if (this.addresses().find((a) => a.id === selectedId)?.isDefault) return;
    this.addresses.update((list) =>
      list.map((addr) => ({ ...addr, isDefault: addr.id === selectedId })),
    );
    this.cartApi.setDefaultAddress(selectedId).subscribe({
      next: (list) => this.addresses.set(list),
      error: (err) => this.onAddressError(err),
    });
  }

  private onAddressError(err: unknown) {
    this.errorMessage.set(apiErrors(err).join(' '));
    this.loadAddresses();
  }

  onSaveProfile() {
    if (!this.hasUnsavedChanges()) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const dto: any = {};
    if (this.userForm.firstName !== this.initialForm.firstName)
      dto.firstName = this.userForm.firstName;
    if (this.userForm.lastName !== this.initialForm.lastName) dto.lastName = this.userForm.lastName;
    if (this.userForm.phone !== this.initialForm.phone) dto.phone = this.userForm.phone;
    if (this.userForm.newPassword) {
      dto.currentPassword = this.userForm.currentPassword;
      dto.newPassword = this.userForm.newPassword;
    }

    this.auth.updateProfile(dto).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set(translate('Profil mis à jour avec succès !'));
        this.initialForm = { ...this.userForm };
        this.userForm.currentPassword = '';
        this.userForm.newPassword = '';
        this.hasUnsavedChanges.set(false);
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = apiErrors(err);
        this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }
}
