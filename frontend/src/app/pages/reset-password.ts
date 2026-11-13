import { Component, inject, OnInit, signal } from '@angular/core';
import { Icon } from '../components/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { apiErrors } from '../core/utils';
import { TPipe, translate } from '../core/i18n';

@Component({
  standalone: true,
  selector: 'app-reset-password',
  imports: [Icon, CommonModule, FormsModule, RouterLink, TPipe],
  template: `
    <div class="reset-wrapper">
      <div class="card reset-card">
        <div class="icon-shield">
          <app-icon name="shield" [size]="28" />
        </div>

        <h2>{{ 'Nouveau mot de passe' | t }}</h2>
        <p class="subtitle">{{ "Choisissez un mot de passe d'au moins 8 caractères." | t }}</p>

        @if (errors().length) {
          <div class="alert alert-error">
            @for (e of errors(); track e) { <p>{{ e }}</p> }
          </div>
        }

        @if (successMessage()) {
          <div class="alert alert-success">
            <p>{{ successMessage() }}</p>
          </div>
          <a routerLink="/connexion" class="btn-submit block-link">{{ 'Se connecter' | t }}</a>
        } @else {
          <form (ngSubmit)="onSubmit()" class="reset-form">
            <div class="form-group">
              <label>{{ 'Nouveau mot de passe' | t }}</label>
              <div class="password-wrapper">
                <input 
                  [type]="showNewPassword() ? 'text' : 'password'" 
                  [(ngModel)]="newPassword" 
                  name="newPassword"
                  (ngModelChange)="checkStrength()"
                  placeholder="••••••••••••"
                  required
                  class="input-field"
                />
                <button type="button" class="eye-btn" (click)="showNewPassword.set(!showNewPassword())">
                  @if (showNewPassword()) {
                    <app-icon name="eyeOff" [size]="18" />
                  } @else {
                    <app-icon name="eye" [size]="18" />
                  }
                </button>
              </div>

              <!-- Barre de robustesse -->
              <div class="strength-bar-container">
                <div class="strength-bar" [style.width.%]="strengthScore() * 25" [ngClass]="strengthColor()"></div>
              </div>
              <span class="strength-label" [ngClass]="strengthColor()">{{ strengthText() | t }}</span>
            </div>

            <div class="form-group">
              <label>{{ 'Confirmer le mot de passe' | t }}</label>
              <div class="password-wrapper">
                <input 
                  [type]="showConfirmPassword() ? 'text' : 'password'" 
                  [(ngModel)]="confirmPassword" 
                  name="confirmPassword"
                  placeholder="••••••••••••"
                  required
                  class="input-field"
                />
                <button type="button" class="eye-btn" (click)="showConfirmPassword.set(!showConfirmPassword())">
                  @if (showConfirmPassword()) {
                    <app-icon name="eyeOff" [size]="18" />
                  } @else {
                    <app-icon name="eye" [size]="18" />
                  }
                </button>
              </div>
            </div>

            <button type="submit" class="btn-submit" [disabled]="busy() || !token()">
              {{ (busy() ? 'Mise à jour…' : 'Réinitialiser le mot de passe') | t }}
            </button>
          </form>
        }

        <a routerLink="/connexion" class="back-link"><app-icon name="arrowLeft" [size]="16" /> {{ 'Retour à la connexion' | t }}</a>
      </div>
    </div>
  `,
  styles: `
    .reset-wrapper { display: flex; justify-content: center; align-items: center; min-height: 70vh; padding: 1.5rem; }
    .reset-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 2.5rem; width: 100%; max-width: 440px; text-align: center; }
    
    .icon-shield { background: color-mix(in srgb, var(--green) 10%, transparent); width: 50px; height: 50px; border-radius: var(--r-md); display: grid; place-items: center; margin: 0 auto 1.2rem; }
    h2 { margin: 0 0 0.4rem; color: var(--text); font-size: var(--fs-2xl); }
    .subtitle { color: var(--muted); font-size: var(--fs-md); margin: 0 0 1.5rem; }

    .reset-form { display: flex; flex-direction: column; gap: 1.2rem; text-align: left; }
    .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
    .form-group label { font-size: var(--fs-md); color: var(--muted); }

    .input-field {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm);
      padding: 0.7rem 0.9rem; color: var(--text); font-size: var(--fs-ui); width: 100%;
    }
    .input-field:focus { outline: none; border-color: var(--accent); }

    .password-wrapper { position: relative; display: flex; align-items: center; }
    .password-wrapper input { padding-right: 2.5rem; }
    .eye-btn { position: absolute; right: 0.8rem; background: none; border: none; color: var(--muted); cursor: pointer; }

    /* BARRE ROBUSTESSE */
    .strength-bar-container { height: 4px; background: var(--border); border-radius: 2px; margin-top: 0.4rem; overflow: hidden; }
    .strength-bar { height: 100%; transition: all 0.3s ease; }
    .strength-label { font-size: var(--fs-xs); font-weight: 600; }
    
    .text-red { color: var(--red); } .bg-red { background: var(--red); }
    .text-orange { color: var(--warn); } .bg-orange { background: var(--warn); }
    .text-green { color: var(--green); } .bg-green { background: var(--green); }

    .btn-submit {
      background: var(--accent); color: var(--on-accent); font-weight: 700; border: none;
      border-radius: var(--r-sm); padding: 0.8rem; cursor: pointer; font-size: var(--fs-ui); margin-top: 0.5rem;
      width: 100%; text-decoration: none; display: inline-block; box-sizing: border-box;
    }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    
    .alert { padding: 0.8rem 1rem; border-radius: var(--r-sm); font-size: var(--fs-md); margin-bottom: 1.2rem; text-align: left; }
    .alert-error { background: color-mix(in srgb, var(--red) 15%, transparent); border: 1px solid color-mix(in srgb, var(--red) 40%, transparent); color: var(--red); }
    .alert-success { background: color-mix(in srgb, var(--green) 15%, transparent); border: 1px solid color-mix(in srgb, var(--green) 40%, transparent); color: var(--green); }

    .back-link { display: inline-block; margin-top: 1.5rem; color: var(--muted); font-size: var(--fs-md); text-decoration: none; }
    .back-link:hover { color: var(--text); }
  `
})
export class ResetPasswordPage implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);

  token = signal<string>('');
  newPassword = '';
  confirmPassword = '';
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  strengthScore = signal(0);
  strengthText = signal('');
  strengthColor = signal('');

  busy = signal(false);
  errors = signal<string[]>([]);
  successMessage = signal<string | null>(null);

  ngOnInit() {
    const queryToken = this.route.snapshot.queryParamMap.get('token');
    if (queryToken) {
      this.token.set(queryToken);
    } else {
      this.errors.set([translate("Token de réinitialisation manquant ou invalide dans l'URL.")]);
    }
  }

  checkStrength() {
    const pwd = this.newPassword;
    if (!pwd) {
      this.strengthScore.set(0);
      this.strengthText.set('');
      this.strengthColor.set('');
      return;
    }

    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    this.strengthScore.set(score);
    if (score <= 2) {
      this.strengthText.set('Mot de passe faible'); // traduit à l'affichage
      this.strengthColor.set('text-red bg-red');
    } else if (score === 3) {
      this.strengthText.set('Mot de passe moyen'); // traduit à l'affichage
      this.strengthColor.set('text-orange bg-orange');
    } else {
      this.strengthText.set('Mot de passe solide'); // traduit à l'affichage
      this.strengthColor.set('text-green bg-green');
    }
  }

  onSubmit() {
    if (this.newPassword !== this.confirmPassword) {
      this.errors.set([translate('Les mots de passe ne correspondent pas.')]);
      return;
    }

    if (!this.token()) {
      this.errors.set([translate('Le token de réinitialisation est invalide.')]);
      return;
    }

    this.busy.set(true);
    this.errors.set([]);
    this.successMessage.set(null);

    this.auth.resetPassword(this.token(), this.newPassword).subscribe({
      next: (res: any) => {
        this.busy.set(false);
        this.successMessage.set(res?.message || translate('Mot de passe réinitialisé avec succès !'));
      },
      error: (err) => {
        this.busy.set(false);
        this.errors.set(apiErrors(err));
      }
    });
  }
}