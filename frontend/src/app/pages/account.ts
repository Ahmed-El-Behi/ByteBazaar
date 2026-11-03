import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth-service';

@Component({
  selector: 'app-account',
  imports: [RouterLink],
  template: `
    <div class="container page">
      <h1>Mon compte</h1>

      @if (auth.user(); as u) {
        <div class="card info">
          <p>
            <strong>{{ u.firstName }} {{ u.lastName }}</strong>
            <span class="badge ok">{{ u.role === 'ADMIN' ? 'Administrateur' : 'Client' }}</span>
          </p>
          <p class="muted">{{ u.email }}</p>
          @if (u.phone) { <p class="muted">{{ u.phone }}</p> }
          <button class="btn" (click)="auth.logout()">Se déconnecter</button>
        </div>

        <div class="grid">
          <div class="card soon"><h3>Mes commandes</h3><p class="muted">Bientôt disponible.</p></div>
          <div class="card soon"><h3>Mes configurations</h3><p class="muted">Bientôt disponible.</p></div>
        </div>
      } @else if (auth.isLoggedIn()) {
        <p class="muted">Chargement…</p>
      } @else {
        <p class="card info">Session expirée. <a routerLink="/connexion"><u>Se reconnecter</u></a></p>
      }
    </div>
  `,
  styles: `
    .page { padding-block: 1.5rem; }
    .info { padding: 1.2rem 1.4rem; margin-bottom: 1.2rem; }
    .info p { margin: 0 0 0.4rem; }
    .info .badge { margin-left: 0.6rem; }
    .info button { margin-top: 0.8rem; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .soon { padding: 1.2rem; }
  `,
})
export class AccountPage {
  readonly auth = inject(AuthService);
}