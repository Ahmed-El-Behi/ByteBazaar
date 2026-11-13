import { Component, inject, signal } from '@angular/core';
import { Icon } from '../components/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { apiErrors, safeRedirect } from '../core/utils';
import { TPipe, translate } from '../core/i18n';

@Component({
  selector: 'app-login',
  imports: [Icon, RouterLink, TPipe],
  template: `
    <div class="card auth-card">
      @if (!forgotMode()) {
        <!-- FORMULAIRE DE CONNEXION -->
        <h1>{{ 'Connexion' | t }}</h1>
        <p class="muted">{{ 'Retrouve ton compte ByteBazaar.' | t }}</p>

        @if (errors().length) {
          <div class="alert">
            @for (e of errors(); track e) { <p>{{ e }}</p> }
          </div>
        }

        <form (submit)="submit($event, email.value, password.value)">
          <div class="field">
            <label for="email">{{ 'Email' | t }}</label>
            <input #email id="email" type="email" required autocomplete="email" />
          </div>
          <div class="field">
            <div class="field-header">
              <label for="password">{{ 'Mot de passe' | t }}</label>
              <button type="button" class="link-btn" (click)="toggleForgotMode(true)">
                {{ 'Mot de passe oublié ?' | t }}
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
                [attr.aria-label]="'Afficher/Masquer le mot de passe' | t"
              >
                @if (showPassword()) {
                  <app-icon name="eyeOff" [size]="18" />
                } @else {
                  <app-icon name="eye" [size]="18" />
                }
              </button>
            </div>
          </div>
          <button class="btn primary block" type="submit" [disabled]="busy()">
            {{ (busy() ? 'Connexion…' : 'Se connecter') | t }}
          </button>
        </form>

        <p class="muted switch">{{ 'Pas encore de compte ?' | t }} <a routerLink="/inscription" class="create-account-link">{{ 'Créer un compte' | t }}</a></p>
      } @else {
        <!-- FORMULAIRE MOT DE PASSE OUBLIÉ -->
        <h1>{{ 'Mot de passe oublié' | t }}</h1>
        <p class="muted">{{ 'Saisis ton adresse email pour recevoir un lien de réinitialisation.' | t }}</p>

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
              <label for="forgotEmail">{{ 'Email' | t }}</label>
              <input #forgotEmail id="forgotEmail" type="email" required autocomplete="email" [placeholder]="'exemple@email.tn' | t" />
            </div>
            <button class="btn primary block" type="submit" [disabled]="busy()">
              {{ (busy() ? 'Envoi en cours…' : 'Envoyer le lien de réinitialisation') | t }}
            </button>
          </form>
        }

        <p class="muted switch">
          <button type="button" class="link-btn" (click)="toggleForgotMode(false)">
            <app-icon name="arrowLeft" [size]="16" /> {{ 'Retour à la connexion' | t }}
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
      color: var(--accent, var(--accent));
      font-size: var(--fs-md);
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
      color: var(--accent, var(--accent));
      font-weight: 600;
      text-decoration: none;
    }
    .create-account-link:hover {
      filter: brightness(1.15);
    }

    .alert-success {
      background: color-mix(in srgb, var(--green) 15%, transparent);
      border: 1px solid color-mix(in srgb, var(--green) 40%, transparent);
      color: var(--green);
      padding: 0.8rem 1rem;
      border-radius: var(--r-sm);
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
          res?.message || translate('Un email contenant le lien de réinitialisation vous a été envoyé.')
        );
      },
      error: (e) => {
        this.errors.set(apiErrors(e));
        this.busy.set(false);
      },
    });
  }
}