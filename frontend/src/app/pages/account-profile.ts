import { Component, inject, signal, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth-service';
import { CartApi, Address } from '../core/cart-api';
import { ComponentCanDeactivate } from '../core/pending-changes.guard';
import { apiErrors } from '../core/utils';

@Component({
  standalone: true,
  selector: 'app-account-profile',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-wrapper">
      <!-- Notifications -->
      @if (successMessage()) {
        <div class="alert-success">{{ successMessage() }}</div>
      }
      @if (errorMessage()) {
        <div class="alert-danger">{{ errorMessage() }}</div>
      }

      <!-- Banner Warning -->
      @if (hasUnsavedChanges()) {
        <div class="warning-banner">
          <div class="warning-info">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>Vous avez des modifications non enregistrées.</span>
          </div>
          <div class="warning-btns">
            <button type="button" class="btn-secondary" (click)="cancelChanges()" [disabled]="isSaving()">Annuler</button>
            <button type="button" class="btn-primary" (click)="onSaveProfile()" [disabled]="isSaving()">
              {{ isSaving() ? 'Enregistrement...' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      }

      <!-- Informations Personnelles -->
      <section class="card">
        <h2 class="card-title">Informations personnelles</h2>

        <form (ngSubmit)="onSaveProfile()" class="form-layout">
          <div class="grid-2">
            <div class="field">
              <label>Prénom</label>
              <input type="text" [(ngModel)]="userForm.firstName" name="firstName" (ngModelChange)="onFormChange()" class="input-tech" />
            </div>

            <div class="field">
              <label>Nom</label>
              <input type="text" [(ngModel)]="userForm.lastName" name="lastName" (ngModelChange)="onFormChange()" class="input-tech" />
            </div>

            <div class="field">
              <label>Email (Non modifiable)</label>
              <input type="email" [value]="userForm.email" disabled class="input-tech disabled" />
            </div>

            <div class="field">
              <label>Téléphone</label>
              <input type="tel" [(ngModel)]="userForm.phone" name="phone" (ngModelChange)="onFormChange()" class="input-tech" />
            </div>
          </div>

          <!-- Section Mot de Passe -->
          <div class="password-box">
            <h3 class="sub-title">Changer le mot de passe</h3>
            
            <div class="grid-2">
              <div class="field">
                <label>Mot de passe actuel</label>
                <div class="input-pass-wrapper">
                  <input 
                    [type]="showCurrentPass() ? 'text' : 'password'" 
                    [(ngModel)]="userForm.currentPassword" 
                    name="currentPassword"
                    (ngModelChange)="onFormChange()"
                    placeholder="••••••••••••"
                    class="input-tech"
                  />
                  <button type="button" class="eye-btn" (click)="showCurrentPass.set(!showCurrentPass())">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                      @if (showCurrentPass()) {
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      } @else {
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      }
                    </svg>
                  </button>
                </div>
              </div>

              <div class="field">
                <label>Nouveau mot de passe</label>
                <div class="input-pass-wrapper">
                  <input 
                    [type]="showNewPass() ? 'text' : 'password'" 
                    [(ngModel)]="userForm.newPassword" 
                    name="newPassword"
                    (ngModelChange)="onFormChange()"
                    placeholder="Au moins 8 caractères"
                    class="input-tech"
                  />
                  <button type="button" class="eye-btn" (click)="showNewPass.set(!showNewPass())">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                      @if (showNewPass()) {
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      } @else {
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      }
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-footer">
            <button type="submit" class="btn-primary" [disabled]="!hasUnsavedChanges() || isSaving()">
              {{ isSaving() ? 'Enregistrement...' : 'Enregistrer les modifications' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Adresses de livraison -->
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Mes adresses de livraison</h2>
          <button type="button" class="btn-secondary" (click)="onAddAddress()">
            {{ showAddressForm() ? 'Annuler' : '+ Ajouter une adresse' }}
          </button>
        </div>

        <!-- Formulaire de création d'adresse -->
        @if (showAddressForm()) {
          <form (ngSubmit)="saveNewAddress()" class="address-form-box">
            <div class="field">
              <label>Adresse</label>
              <input 
                type="text" 
                [(ngModel)]="newAddressForm.street" 
                name="addrStreet" 
                placeholder="N°, rue, immeuble..." 
                class="input-tech" 
                required
              />
            </div>

            <div class="grid-3">
              <div class="field">
                <label>Gouvernorat</label>
                <select [(ngModel)]="newAddressForm.governorate" name="addrGov" class="input-tech" required>
                  <option value="" disabled selected>Choisir...</option>
                  @for (gov of governorates; track gov) {
                    <option [value]="gov">{{ gov }}</option>
                  }
                </select>
              </div>

              <div class="field">
                <label>Ville</label>
                <input 
                  type="text" 
                  [(ngModel)]="newAddressForm.city" 
                  name="addrCity" 
                  placeholder="Ex: Tunis" 
                  class="input-tech" 
                  required
                />
              </div>

              <div class="field">
                <label>Code postal</label>
                <input 
                  type="text" 
                  [(ngModel)]="newAddressForm.postalCode" 
                  name="addrZip" 
                  placeholder="Ex: 1000" 
                  class="input-tech" 
                  required
                />
              </div>
            </div>

            <div class="grid-3">
              <div class="field">
                <label>Enregistrer sous</label>
                <select [(ngModel)]="newAddressForm.label" name="addrLabel" class="input-tech" required>
                  <option value="Domicile">Domicile</option>
                  <option value="Bureau">Bureau</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>

            <div class="address-form-actions">
              <button type="button" class="btn-secondary" (click)="showAddressForm.set(false)">Annuler</button>
              <button type="submit" class="btn-primary">Enregistrer l'adresse</button>
            </div>
          </form>
        }

        <!-- Grille des adresses -->
        <div class="address-grid">
          @for (addr of addresses(); track addr.id) {
            <div 
              class="address-card" 
              [class.active]="addr.isDefault"
              (click)="setDefaultAddress(addr.id)"
            >
              <!-- Bouton Croix Rouge -->
              <button 
                type="button" 
                class="btn-delete" 
                title="Supprimer cette adresse"
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
                <span class="badge-label">{{ addr.label }}</span>
                @if (addr.isDefault) {
                  <span class="badge-accent">Par défaut</span>
                }
              </div>
              <p class="addr-details">{{ addr.street }}</p>
              <p class="addr-details">{{ addr.city }}, {{ addr.governorate }} {{ addr.postalCode }}</p>
              @if (addr.phone) {
                <p class="addr-details phone">{{ addr.phone }}</p>
              }
            </div>
          } @empty {
            @if (!showAddressForm()) {
              <p class="muted">Aucune adresse enregistrée pour le moment.</p>
            }
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .profile-wrapper { display: flex; flex-direction: column; gap: 1.5rem; }

    .alert-success { background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; padding: 0.8rem 1.2rem; border-radius: 12px; font-size: 0.9rem; }
    .alert-danger { background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #ef4444; padding: 0.8rem 1.2rem; border-radius: 12px; font-size: 0.9rem; }

    .warning-banner { background: rgba(245, 158, 11, 0.12); border: 1px solid var(--accent); border-radius: 12px; padding: 0.8rem 1.2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; color: var(--accent); }
    .warning-info { display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; font-weight: 500; }
    .warning-btns { display: flex; gap: 0.5rem; }

    .card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; padding: 1.5rem; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; }
    .card-title { font-size: 1.2rem; font-weight: 500; color: var(--text); margin: 0 0 1.2rem 0; }
    .card-header .card-title { margin: 0; }

    .form-layout { display: flex; flex-direction: column; gap: 1.5rem; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }

    .field { display: flex; flex-direction: column; gap: 0.4rem; }
    .field label { font-size: 0.85rem; color: var(--muted); font-weight: 400; }

    .input-tech { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 1rem; color: var(--text); font-size: 0.95rem; outline: none; transition: border-color 0.2s ease; }
    .input-tech:focus { border-color: var(--accent); }
    .input-tech.disabled { opacity: 0.5; cursor: not-allowed; }
    select.input-tech option { background: #0f172a; color: #fff; }

    .password-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; display: flex; flex-direction: column; gap: 1rem; }
    .sub-title { font-size: 0.95rem; color: var(--text); font-weight: 500; margin: 0; }

    .input-pass-wrapper { position: relative; display: flex; align-items: center; }
    .input-pass-wrapper input { width: 100%; padding-right: 2.8rem; }
    .eye-btn { position: absolute; right: 0.8rem; background: none; border: none; color: var(--muted); cursor: pointer; display: flex; align-items: center; }
    .eye-btn:hover { color: var(--text); }

    .address-form-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
    .address-form-actions { display: flex; justify-content: flex-end; gap: 0.8rem; margin-top: 0.5rem; }

    .btn-primary { background: var(--accent); color: #000; border: none; border-radius: 99px; padding: 0.6rem 1.4rem; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: opacity 0.2s ease; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 99px; padding: 0.5rem 1.2rem; font-weight: 500; font-size: 0.85rem; cursor: pointer; transition: background 0.2s ease; }
    .btn-secondary:hover { background: var(--border); }

    .form-footer { display: flex; justify-content: flex-end; }

    .address-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .address-card { 
      background: var(--surface); 
      border: 1px solid var(--border); 
      border-radius: 12px; 
      padding: 1rem; 
      cursor: pointer; 
      transition: all 0.2s ease; 
      display: flex; 
      flex-direction: column; 
      gap: 0.4rem;
      position: relative;
    }
    .address-card.active { border-color: var(--accent); }

    .btn-delete {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #ef4444;
      color: #ffffff;
      border: 2px solid var(--surface-2, #0f172a);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
      line-height: 1;
      cursor: pointer;
      opacity: 0;
      transform: scale(0.8);
      transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
      z-index: 10;
    }

    .address-card:hover .btn-delete {
      opacity: 1;
      transform: scale(1);
    }

    .btn-delete:hover {
      background: #dc2626;
      transform: scale(1.1);
    }

    .address-top { display: flex; align-items: center; gap: 0.5rem; padding-right: 1rem; }
    .radio-tech { accent-color: var(--accent); cursor: pointer; }
    .addr-title { font-weight: 600; color: var(--text); font-size: 0.95rem; }
    .badge-label { font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; background: var(--surface-2); color: var(--muted); }
    .badge-accent { background: rgba(245, 158, 11, 0.15); color: var(--accent); font-size: 0.7rem; font-weight: 500; padding: 0.15rem 0.5rem; border-radius: 99px; margin-left: auto; }
    .addr-details { font-size: 0.85rem; color: var(--muted); margin: 0; padding-left: 1.5rem; }
    .addr-details.phone { opacity: 0.8; }
    .muted { color: var(--muted); font-size: 0.9rem; }
  `
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
    'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
    'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba',
    'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana',
    'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
  ];

  newAddressForm = {
    street: '',
    governorate: '',
    city: '',
    postalCode: '',
    label: 'Domicile'
  };

  userForm = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: ''
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
      error: () => this.addresses.set([])
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
      this.userForm.newPassword !== ''
    );
  }

  cancelChanges() {
    this.userForm = { ...this.initialForm, currentPassword: '', newPassword: '' };
    this.hasUnsavedChanges.set(false);
    this.errorMessage.set(null);
  }

  onAddAddress() {
    this.showAddressForm.update(v => !v);
  }

  saveNewAddress() {
    if (!this.newAddressForm.street || !this.newAddressForm.city || !this.newAddressForm.postalCode || !this.newAddressForm.governorate) {
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
      label: this.newAddressForm.label
    };

    this.cartApi.createAddress(payload).subscribe({
      next: (newAddr) => {
        this.addresses.update(list => [...list, newAddr]);
        this.newAddressForm = { street: '', governorate: '', city: '', postalCode: '', label: 'Domicile' };
        this.showAddressForm.set(false);
      },
      error: () => {
        const fallbackAddr: Address = {
          id: Date.now(),
          ...payload,
          isDefault: this.addresses().length === 0
        };
        this.addresses.update(list => [...list, fallbackAddr]);
        this.newAddressForm = { street: '', governorate: '', city: '', postalCode: '', label: 'Domicile' };
        this.showAddressForm.set(false);
      }
    });
  }

  deleteAddress(id: number, event: Event) {
    event.stopPropagation();
    this.addresses.update(list => list.filter(addr => addr.id !== id));
    this.cartApi.deleteAddress(id).subscribe();
  }

  // DÉFINITION PERSISTANTE DE L'ADRESSE PAR DÉFAUT
  setDefaultAddress(selectedId: number) {
    this.addresses.update(list =>
      list.map(addr => ({ ...addr, isDefault: addr.id === selectedId }))
    );
    this.cartApi.setDefaultAddress(selectedId).subscribe();
  }

  onSaveProfile() {
    if (!this.hasUnsavedChanges()) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const dto: any = {};
    if (this.userForm.firstName !== this.initialForm.firstName) dto.firstName = this.userForm.firstName;
    if (this.userForm.lastName !== this.initialForm.lastName) dto.lastName = this.userForm.lastName;
    if (this.userForm.phone !== this.initialForm.phone) dto.phone = this.userForm.phone;
    if (this.userForm.newPassword) {
      dto.currentPassword = this.userForm.currentPassword;
      dto.newPassword = this.userForm.newPassword;
    }

    this.auth.updateProfile(dto).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.successMessage.set('Profil mis à jour avec succès !');
        this.initialForm = { ...this.userForm };
        this.userForm.currentPassword = '';
        this.userForm.newPassword = '';
        this.hasUnsavedChanges.set(false);
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = apiErrors(err);
        this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    });
  }
}