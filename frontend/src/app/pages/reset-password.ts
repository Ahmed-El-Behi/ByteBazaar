import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { apiErrors } from '../core/utils';

@Component({
  standalone: true,
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="reset-wrapper">
      <div class="card reset-card">
        <div class="icon-shield">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#10b981" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>

        <h2>Nouveau mot de passe</h2>
        <p class="subtitle">Choisissez un mot de passe d'au moins 8 caractères.</p>

        @if (errors().length) {
          <div class="alert alert-error">
            @for (e of errors(); track e) { <p>{{ e }}</p> }
          </div>
        }

        @if (successMessage()) {
          <div class="alert alert-success">
            <p>{{ successMessage() }}</p>
          </div>
          <a routerLink="/connexion" class="btn-submit block-link">Se connecter</a>
        } @else {
          <form (ngSubmit)="onSubmit()" class="reset-form">
            <div class="form-group">
              <label>Nouveau mot de passe</label>
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

              <!-- Barre de robustesse -->
              <div class="strength-bar-container">
                <div class="strength-bar" [style.width.%]="strengthScore() * 25" [ngClass]="strengthColor()"></div>
              </div>
              <span class="strength-label" [ngClass]="strengthColor()">{{ strengthText() }}</span>
            </div>

            <div class="form-group">
              <label>Confirmer le mot de passe</label>
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

            <button type="submit" class="btn-submit" [disabled]="busy() || !token()">
              {{ busy() ? 'Mise à jour…' : 'Réinitialiser le mot de passe' }}
            </button>
          </form>
        }

        <a routerLink="/connexion" class="back-link">← Retour à la connexion</a>
      </div>
    </div>
  `,
  styles: `
    .reset-wrapper { display: flex; justify-content: center; align-items: center; min-height: 70vh; padding: 1.5rem; }
    .reset-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 16px; padding: 2.5rem; width: 100%; max-width: 440px; text-align: center; }
    
    .icon-shield { background: rgba(16, 185, 129, 0.1); width: 50px; height: 50px; border-radius: 12px; display: grid; place-items: center; margin: 0 auto 1.2rem; }
    h2 { margin: 0 0 0.4rem; color: var(--text); font-size: 1.5rem; }
    .subtitle { color: var(--muted); font-size: 0.88rem; margin: 0 0 1.5rem; }

    .reset-form { display: flex; flex-direction: column; gap: 1.2rem; text-align: left; }
    .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
    .form-group label { font-size: 0.85rem; color: var(--muted); }

    .input-field {
      background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
      padding: 0.7rem 0.9rem; color: var(--text); font-size: 0.95rem; width: 100%;
    }
    .input-field:focus { outline: none; border-color: var(--accent); }

    .password-wrapper { position: relative; display: flex; align-items: center; }
    .password-wrapper input { padding-right: 2.5rem; }
    .eye-btn { position: absolute; right: 0.8rem; background: none; border: none; color: var(--muted); cursor: pointer; }

    /* BARRE ROBUSTESSE */
    .strength-bar-container { height: 4px; background: var(--border); border-radius: 2px; margin-top: 0.4rem; overflow: hidden; }
    .strength-bar { height: 100%; transition: all 0.3s ease; }
    .strength-label { font-size: 0.75rem; font-weight: 600; }
    
    .text-red { color: #ef4444; } .bg-red { background: #ef4444; }
    .text-orange { color: #f59e0b; } .bg-orange { background: #f59e0b; }
    .text-green { color: #10b981; } .bg-green { background: #10b981; }

    .btn-submit {
      background: var(--accent); color: #000; font-weight: 700; border: none;
      border-radius: 8px; padding: 0.8rem; cursor: pointer; font-size: 0.95rem; margin-top: 0.5rem;
      width: 100%; text-decoration: none; display: inline-block; box-sizing: border-box;
    }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    
    .alert { padding: 0.8rem 1rem; border-radius: 8px; font-size: 0.88rem; margin-bottom: 1.2rem; text-align: left; }
    .alert-error { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; }
    .alert-success { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.4); color: #22c55e; }

    .back-link { display: inline-block; margin-top: 1.5rem; color: var(--muted); font-size: 0.85rem; text-decoration: none; }
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
      this.errors.set(['Token de réinitialisation manquant ou invalide dans l\'URL.']);
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
      this.strengthText.set('Mot de passe faible');
      this.strengthColor.set('text-red bg-red');
    } else if (score === 3) {
      this.strengthText.set('Mot de passe moyen');
      this.strengthColor.set('text-orange bg-orange');
    } else {
      this.strengthText.set('Mot de passe solide');
      this.strengthColor.set('text-green bg-green');
    }
  }

  onSubmit() {
    if (this.newPassword !== this.confirmPassword) {
      this.errors.set(['Les mots de passe ne correspondent pas.']);
      return;
    }

    if (!this.token()) {
      this.errors.set(['Le token de réinitialisation est invalide.']);
      return;
    }

    this.busy.set(true);
    this.errors.set([]);
    this.successMessage.set(null);

    this.auth.resetPassword(this.token(), this.newPassword).subscribe({
      next: (res: any) => {
        this.busy.set(false);
        this.successMessage.set(res?.message || 'Mot de passe réinitialisé avec succès !');
      },
      error: (err) => {
        this.busy.set(false);
        this.errors.set(apiErrors(err));
      }
    });
  }
}