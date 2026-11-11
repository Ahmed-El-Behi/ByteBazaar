import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { apiErrors, safeRedirect } from '../core/utils';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  template: `
    <div class="card auth-card">
      @if (!forgotMode()) {
        <!-- FORMULAIRE DE CONNEXION -->
        <h1>Connexion</h1>
        <p class="muted">Retrouve ton compte ByteBazaar.</p>

        @if (errors().length) {
          <div class="alert">
            @for (e of errors(); track e) { <p>{{ e }}</p> }
          </div>
        }

        <form (submit)="submit($event, email.value, password.value)">
          <div class="field">
            <label for="email">Email</label>
            <input #email id="email" type="email" required autocomplete="email" />
          </div>
          <div class="field">
            <div class="field-header">
              <label for="password">Mot de passe</label>
              <button type="button" class="link-btn" (click)="toggleForgotMode(true)">
                Mot de passe oublié ?
              </button>
            </div>
            
            <div class="password-wrapper">
              <input
                #password
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                required
                autocomplete="current-password"
              />
              <button
                type="button"
                class="eye-btn"
                (click)="showPassword.set(!showPassword())"
                aria-label="Afficher/Masquer le mot de passe"
              >
                @if (showPassword()) {
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                }
              </button>
            </div>
          </div>
          <button class="btn primary block" type="submit" [disabled]="busy()">
            {{ busy() ? 'Connexion…' : 'Se connecter' }}
          </button>
        </form>

        <p class="muted switch">Pas encore de compte ? <a routerLink="/inscription" class="create-account-link">Créer un compte</a></p>
      } @else {
        <!-- FORMULAIRE MOT DE PASSE OUBLIÉ -->
        <h1>Mot de passe oublié</h1>
        <p class="muted">Saisis ton adresse email pour recevoir un lien de réinitialisation.</p>

        @if (errors().length) {
          <div class="alert">
            @for (e of errors(); track e) { <p>{{ e }}</p> }
          </div>
        }

        @if (successMessage()) {
          <div class="alert alert-success">
            <p>{{ successMessage() }}</p>
          </div>
        } @else {
          <form (submit)="submitForgot($event, forgotEmail.value)">
            <div class="field">
              <label for="forgotEmail">Email</label>
              <input #forgotEmail id="forgotEmail" type="email" required autocomplete="email" placeholder="exemple@email.tn" />
            </div>
            <button class="btn primary block" type="submit" [disabled]="busy()">
              {{ busy() ? 'Envoi en cours…' : 'Envoyer le lien de réinitialisation' }}
            </button>
          </form>
        }

        <p class="muted switch">
          <button type="button" class="link-btn" (click)="toggleForgotMode(false)">
            ← Retour à la connexion
          </button>
        </p>
      }
    </div>
  `,
  styles: `
    .switch { margin-top: 1.2rem; text-align: center; }
    .field-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.3rem;
    }
    .field-header label { margin-bottom: 0; }
    
    /* BOUTON MOT DE PASSE OUBLIÉ (SANS SOULIGNEMENT) */
    .link-btn {
      background: none;
      border: none;
      color: var(--accent, #f59e0b);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      text-decoration: none; /* Supprime le soulignement */
      transition: opacity 0.2s ease, filter 0.2s ease;
    }
    .link-btn:hover {
      opacity: 0.9;
      filter: brightness(1.15); /* Effet d'illumination au survol */
    }

    .create-account-link {
      color: var(--accent, #f59e0b);
      font-weight: 600;
      text-decoration: none;
    }
    .create-account-link:hover {
      filter: brightness(1.15);
    }

    .alert-success {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #22c55e;
      padding: 0.8rem 1rem;
      border-radius: 10px;
      margin-bottom: 1rem;
    }
    .password-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .password-wrapper input {
      width: 100%;
      padding-right: 2.5rem;
    }
    .eye-btn {
      position: absolute;
      right: 0.8rem;
      background: none;
      border: none;
      color: var(--muted, #94a3b8);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: color 0.2s ease;
    }
    .eye-btn:hover {
      color: var(--text, #ffffff);
    }
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly errors = signal<string[]>([]);
  readonly busy = signal(false);
  readonly forgotMode = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  toggleForgotMode(enable: boolean) {
    this.forgotMode.set(enable);
    this.errors.set([]);
    this.successMessage.set(null);
  }

  submit(event: Event, email: string, password: string) {
    event.preventDefault();
    this.busy.set(true);
    this.errors.set([]);
    this.auth.login(email, password).subscribe({
      next: () =>
        this.router.navigateByUrl(safeRedirect(this.route.snapshot.queryParamMap.get('redirect'))),
      error: (e) => {
        this.errors.set(apiErrors(e));
        this.busy.set(false);
      },
    });
  }

  submitForgot(event: Event, email: string) {
    event.preventDefault();
    if (!email.trim()) return;

    this.busy.set(true);
    this.errors.set([]);
    this.successMessage.set(null);

    this.auth.forgotPassword(email.trim()).subscribe({
      next: (res: any) => {
        this.busy.set(false);
        this.successMessage.set(
          res?.message || 'Un email contenant le lien de réinitialisation vous a été envoyé.'
        );
      },
      error: (e) => {
        this.errors.set(apiErrors(e));
        this.busy.set(false);
      },
    });
  }
}