import { Component, signal } from '@angular/core';
import { Icon } from '../components/icon';
import { FormsModule } from '@angular/forms';
import { TPipe } from '../core/i18n';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [Icon, FormsModule, TPipe],
  template: `
    <div class="container page">
      <div class="header">
        <h1>{{ 'Contactez-nous' | t }}</h1>
        <p class="muted">
          {{ 'Une question sur un composant, une commande ou une configuration ? Notre équipe répond sous 24 h.' | t }}
        </p>
      </div>

      <div class="contact-grid">
        <!-- Formulaire de Contact -->
        <div class="card form-card">
          @if (submitted()) {
            <div class="success-message">
              <div class="success-icon-wrapper">
                <app-icon name="check" [size]="30" [stroke]="2.25" />
              </div>
              <h3>{{ 'Message envoyé avec succès !' | t }}</h3>
              <p class="muted">{{ 'Nous vous répondrons dans les plus brefs délais.' | t }}</p>
              <button class="btn primary" (click)="resetForm()" style="margin-top: 1.5rem;">
                {{ 'Envoyer un autre message' | t }}
              </button>
            </div>
          } @else {
            <form (ngSubmit)="onSubmit()">
              <div class="form-row">
                <div class="form-group">
                  <label for="fullName">{{ 'Nom complet' | t }}</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    [(ngModel)]="form.fullName"
                    placeholder="Amine Ben Salah"
                    required
                  />
                </div>
                <div class="form-group">
                  <label for="email">{{ 'Email' | t }}</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    [(ngModel)]="form.email"
                    [placeholder]="'prenom.nom@email.tn' | t"
                    required
                  />
                </div>
              </div>

              <!-- Menu Déroulant Personnalisé Pro -->
              <div class="form-group">
                <label>{{ 'Sujet' | t }}</label>
                <div class="custom-select" (click)="dropdownOpen.set(!dropdownOpen())">
                  <div class="select-trigger">
                    <span>{{ form.subject | t }}</span>
                    <app-icon class="chevron" [class.open]="dropdownOpen()" name="chevronDown" [size]="18" />
                  </div>

                  @if (dropdownOpen()) {
                    <div class="select-dropdown">
                      @for (option of subjectOptions; track option) {
                        <div 
                          class="option-item" 
                          [class.selected]="form.subject === option"
                          (click)="selectSubject(option, $event)"
                        >
                          {{ option | t }}
                          @if (form.subject === option) {
                            <app-icon name="check" [size]="16" [stroke]="2.25" />
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <div class="form-group">
                <label for="message">{{ 'Message' | t }}</label>
                <textarea
                  id="message"
                  name="message"
                  rows="5"
                  [(ngModel)]="form.message"
                  [placeholder]="'Bonjour, je souhaite...' | t"
                  required
                ></textarea>
              </div>

              <button type="submit" class="btn primary">{{ 'Envoyer le message' | t }}</button>
            </form>
          }
        </div>

        <!-- Bloc Coordonnées -->
        <div class="card info-card">
          <h2>{{ 'Nos coordonnées' | t }}</h2>

          <div class="info-list">
            <div class="info-item">
              <div class="info-icon">
                <app-icon name="mail" [size]="20" />
              </div>
              <div class="info-content">
                <span class="info-label">{{ 'E-mail' | t }}</span>
                <a href="mailto:contact@ByteBazaar.tn" class="info-value">contact&#64;ByteBazaar.tn</a>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">
                <app-icon name="mapPin" [size]="20" />
              </div>
              <div class="info-content">
                <span class="info-label">{{ 'Adresse' | t }}</span>
                <span class="info-value">{{ 'Tunis, Tunisie' | t }}</span>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">
                <app-icon name="headphones" [size]="20" />
              </div>
              <div class="info-content">
                <span class="info-label">{{ 'Support' | t }}</span>
                <span class="info-value">{{ 'Lundi - Samedi · 9h - 18h' | t }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .page {
      padding-block: 3rem;
      max-width: 1100px;
      margin-inline: auto;
    }
    .header {
      margin-bottom: 2.5rem;
    }
    .header h1 {
      font-size: var(--fs-4xl);
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--text, inherit);
    }
    .muted {
      color: var(--muted, #8c94a4);
    }
    .contact-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 2rem;
    }
    @media (max-width: 850px) {
      .contact-grid { grid-template-columns: 1fr; }
    }
    
    .card {
      background: var(--surface-1, var(--surface, rgba(255, 255, 255, 0.03)));
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      border-radius: var(--r-md);
      padding: 2rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 550px) {
      .form-row { grid-template-columns: 1fr; }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1.2rem;
      position: relative;
    }
    .form-group label {
      font-size: var(--fs-md);
      font-weight: 500;
      color: var(--muted, #8c94a4);
    }
    
    input, textarea {
      width: 100%;
      background: var(--surface-2, var(--surface, rgba(0, 0, 0, 0.05)));
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      border-radius: var(--r-sm);
      padding: 0.75rem 1rem;
      color: var(--text, inherit);
      font-family: inherit;
      font-size: var(--fs-ui);
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus, textarea:focus {
      border-color: var(--accent, var(--accent));
    }

    /* CUSTOM SELECT DROPDOWN ADAPTATIF */
    .custom-select {
      position: relative;
      cursor: pointer;
      user-select: none;
    }
    .select-trigger {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--surface-2, var(--surface, rgba(0, 0, 0, 0.05)));
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      border-radius: var(--r-sm);
      padding: 0.75rem 1rem;
      color: var(--text, inherit);
      font-size: var(--fs-ui);
      transition: border-color 0.2s;
    }
    .custom-select:hover .select-trigger {
      border-color: var(--accent, var(--accent));
    }
    .chevron {
      color: var(--muted, #8c94a4);
      transition: transform 0.2s ease;
    }
    .chevron.open {
      transform: rotate(180deg);
      color: var(--accent, var(--accent));
    }

    .select-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: var(--surface-1, #182032);
      border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
      border-radius: var(--r-md);
      padding: 0.4rem;
      z-index: 50;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }
    .option-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.7rem 0.9rem;
      border-radius: var(--r-sm);
      font-size: var(--fs-ui);
      color: var(--text, inherit);
      transition: background 0.15s;
    }
    .option-item:hover {
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .option-item.selected {
      background: var(--accent, var(--accent));
      color: var(--on-accent) !important;
      font-weight: 600;
    }

    /* BOUTON */
    .btn.primary {
      background: var(--accent, var(--accent));
      color: var(--on-accent);
      font-weight: 600;
      padding: 0.8rem 1.8rem;
      border-radius: var(--r-xl);
      border: none;
      cursor: pointer;
      font-size: var(--fs-ui);
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn.primary:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    /* COORDONNÉES */
    .info-card h2 {
      font-size: var(--fs-xl);
      margin-bottom: 2rem;
      font-weight: 600;
      color: var(--text, inherit);
    }
    .info-list {
      display: flex;
      flex-direction: column;
      gap: 1.8rem;
    }
    .info-item {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .info-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--r-md);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      color: var(--accent, var(--accent));
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .info-content {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: var(--fs-sm);
      color: var(--muted, #8c94a4);
    }
    .info-value {
      font-size: var(--fs-base);
      font-weight: 600;
      color: var(--text, inherit);
      text-decoration: none;
    }
    a.info-value:hover {
      color: var(--accent, var(--accent));
    }

    /* MESSAGE SUCCÈS */
    .success-message {
      text-align: center;
      padding-block: 2rem;
    }
    .success-icon-wrapper {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--green) 15%, transparent);
      color: var(--green);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.2rem;
    }
    .success-message h3 {
      font-size: var(--fs-2xl);
      color: var(--text, inherit);
      margin-bottom: 0.4rem;
    }
  `,
})
export class ContactPage {
  submitted = signal(false);
  dropdownOpen = signal(false);

  // Sujets en français (valeur du formulaire), traduits à l'affichage
  // i18n
  subjectOptions = [
    'Question sur une commande',
    'Aide à la configuration PC',
    'Service après-vente (SAV)',
    'Autre demande',
  ];
  // /i18n

  form = {
    fullName: '',
    email: '',
    subject: 'Question sur une commande',
    message: '',
  };

  selectSubject(option: string, event: Event) {
    event.stopPropagation();
    this.form.subject = option;
    this.dropdownOpen.set(false);
  }

  onSubmit() {
    if (this.form.fullName && this.form.email && this.form.message) {
      this.submitted.set(true);
    }
  }

  resetForm() {
    this.form = {
      fullName: '',
      email: '',
      subject: 'Question sur une commande',
      message: '',
    };
    this.submitted.set(false);
  }
}