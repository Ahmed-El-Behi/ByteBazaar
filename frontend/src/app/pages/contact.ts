import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container page">
      <div class="header">
        <h1>Contactez-nous</h1>
        <p class="muted">
          Une question sur un composant, une commande ou une configuration ? Notre équipe répond sous 24 h.
        </p>
      </div>

      <div class="contact-grid">
        <!-- Formulaire de Contact -->
        <div class="card form-card">
          @if (submitted()) {
            <div class="success-message">
              <div class="success-icon-wrapper">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h3>Message envoyé avec succès !</h3>
              <p class="muted">Nous vous répondrons dans les plus brefs délais.</p>
              <button class="btn primary" (click)="resetForm()" style="margin-top: 1.5rem;">
                Envoyer un autre message
              </button>
            </div>
          } @else {
            <form (ngSubmit)="onSubmit()">
              <div class="form-row">
                <div class="form-group">
                  <label for="fullName">Nom complet</label>
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
                  <label for="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    [(ngModel)]="form.email"
                    placeholder="prenom.nom@email.tn"
                    required
                  />
                </div>
              </div>

              <!-- Menu Déroulant Personnalisé Pro -->
              <div class="form-group">
                <label>Sujet</label>
                <div class="custom-select" (click)="dropdownOpen.set(!dropdownOpen())">
                  <div class="select-trigger">
                    <span>{{ form.subject }}</span>
                    <svg class="chevron" [class.open]="dropdownOpen()" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>

                  @if (dropdownOpen()) {
                    <div class="select-dropdown">
                      @for (option of subjectOptions; track option) {
                        <div 
                          class="option-item" 
                          [class.selected]="form.subject === option"
                          (click)="selectSubject(option, $event)"
                        >
                          {{ option }}
                          @if (form.subject === option) {
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <div class="form-group">
                <label for="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows="5"
                  [(ngModel)]="form.message"
                  placeholder="Bonjour, je souhaite..."
                  required
                ></textarea>
              </div>

              <button type="submit" class="btn primary">Envoyer le message</button>
            </form>
          }
        </div>

        <!-- Bloc Coordonnées -->
        <div class="card info-card">
          <h2>Nos coordonnées</h2>

          <div class="info-list">
            <div class="info-item">
              <div class="info-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <div class="info-content">
                <span class="info-label">E-mail</span>
                <a href="mailto:contact@ByteBazaar.tn" class="info-value">contact&#64;ByteBazaar.tn</a>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div class="info-content">
                <span class="info-label">Adresse</span>
                <span class="info-value">Tunis, Tunisie</span>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                </svg>
              </div>
              <div class="info-content">
                <span class="info-label">Support</span>
                <span class="info-value">Lundi - Samedi · 9h - 18h</span>
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
      font-size: 2.2rem;
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
      border-radius: 16px;
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
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--muted, #8c94a4);
    }
    
    input, textarea {
      width: 100%;
      background: var(--surface-2, var(--surface, rgba(0, 0, 0, 0.05)));
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      border-radius: 10px;
      padding: 0.75rem 1rem;
      color: var(--text, inherit);
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus, textarea:focus {
      border-color: var(--accent, #f59e0b);
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
      border-radius: 10px;
      padding: 0.75rem 1rem;
      color: var(--text, inherit);
      font-size: 0.95rem;
      transition: border-color 0.2s;
    }
    .custom-select:hover .select-trigger {
      border-color: var(--accent, #f59e0b);
    }
    .chevron {
      color: var(--muted, #8c94a4);
      transition: transform 0.2s ease;
    }
    .chevron.open {
      transform: rotate(180deg);
      color: var(--accent, #f59e0b);
    }

    .select-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: var(--surface-1, #182032);
      border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
      border-radius: 12px;
      padding: 0.4rem;
      z-index: 50;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }
    .option-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.7rem 0.9rem;
      border-radius: 8px;
      font-size: 0.92rem;
      color: var(--text, inherit);
      transition: background 0.15s;
    }
    .option-item:hover {
      background: rgba(245, 158, 11, 0.12);
    }
    .option-item.selected {
      background: var(--accent, #f59e0b);
      color: #000 !important;
      font-weight: 600;
    }

    /* BOUTON */
    .btn.primary {
      background: var(--accent, #f59e0b);
      color: #000;
      font-weight: 600;
      padding: 0.8rem 1.8rem;
      border-radius: 25px;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn.primary:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    /* COORDONNÉES */
    .info-card h2 {
      font-size: 1.3rem;
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
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.12);
      color: var(--accent, #f59e0b);
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
      font-size: 0.8rem;
      color: var(--muted, #8c94a4);
    }
    .info-value {
      font-size: 0.98rem;
      font-weight: 600;
      color: var(--text, inherit);
      text-decoration: none;
    }
    a.info-value:hover {
      color: var(--accent, #f59e0b);
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
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.2rem;
    }
    .success-message h3 {
      font-size: 1.4rem;
      color: var(--text, inherit);
      margin-bottom: 0.4rem;
    }
  `,
})
export class ContactPage {
  submitted = signal(false);
  dropdownOpen = signal(false);

  subjectOptions = [
    'Question sur une commande',
    'Aide à la configuration PC',
    'Service après-vente (SAV)',
    'Autre demande',
  ];

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