import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { RegisterInput } from '../core/models';
import { apiErrors, safeRedirect } from '../core/utils';

@Component({
  selector: 'app-register',
  imports: [RouterLink],
  template: `
    <div class="card auth-card">
      <h1>Créer un compte</h1>
      <p class="muted">Pour commander et sauvegarder tes configurations.</p>

      @if (errors().length) {
        <div class="alert">
          @for (e of errors(); track e) { <p>{{ e }}</p> }
        </div>
      }

      <form
        (submit)="
          submit($event, {
            firstName: firstName.value,
            lastName: lastName.value,
            email: email.value,
            phone: phone.value,
            password: password.value
          })
        "
      >
        <div class="form-row">
          <div class="field">
            <label for="firstName">Prénom</label>
            <input #firstName id="firstName" type="text" required autocomplete="given-name" />
          </div>
          <div class="field">
            <label for="lastName">Nom</label>
            <input #lastName id="lastName" type="text" required autocomplete="family-name" />
          </div>
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input #email id="email" type="email" required autocomplete="email" />
        </div>
        <div class="field">
          <label for="phone">Téléphone (facultatif)</label>
          <input #phone id="phone" type="tel" autocomplete="tel" />
        </div>
        <div class="field">
          <label for="password">Mot de passe (8 caractères minimum)</label>
          <input #password id="password" type="password" required minlength="8" autocomplete="new-password" />
        </div>
        <button class="btn primary block" type="submit" [disabled]="busy()">
          {{ busy() ? 'Création…' : 'Créer mon compte' }}
        </button>
      </form>

      <p class="muted switch">Déjà inscrit ? <a routerLink="/connexion"><u>Se connecter</u></a></p>
    </div>
  `,
  styles: `.switch { margin-top: 1.2rem; text-align: center; }`,
})
export class RegisterPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly errors = signal<string[]>([]);
  readonly busy = signal(false);

  submit(event: Event, data: RegisterInput) {
    event.preventDefault();
    this.busy.set(true);
    this.errors.set([]);
    this.auth.register(data).subscribe({
      next: () =>
        this.router.navigateByUrl(safeRedirect(this.route.snapshot.queryParamMap.get('redirect'))),
      error: (e) => {
        this.errors.set(apiErrors(e));
        this.busy.set(false);
      },
    });
  }
}