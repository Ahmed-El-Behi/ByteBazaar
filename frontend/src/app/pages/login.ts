import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { apiErrors, safeRedirect } from '../core/utils';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  template: `
    <div class="card auth-card">
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
          <label for="password">Mot de passe</label>
          <input #password id="password" type="password" required autocomplete="current-password" />
        </div>
        <button class="btn primary block" type="submit" [disabled]="busy()">
          {{ busy() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>

      <p class="muted switch">Pas encore de compte ? <a routerLink="/inscription"><u>Créer un compte</u></a></p>
    </div>
  `,
  styles: `.switch { margin-top: 1.2rem; text-align: center; }`,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly errors = signal<string[]>([]);
  readonly busy = signal(false);

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
}