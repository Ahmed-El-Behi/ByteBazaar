import { Component, inject } from '@angular/core';
import { Icon } from '../components/icon';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth-service';
import { TPipe } from '../core/i18n';

@Component({
  standalone: true,
  selector: 'app-account',
  imports: [Icon, CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TPipe],
  template: `
    <div class="account-container">
      <h1 class="page-title">{{ 'Mon compte' | t }}</h1>

      <div class="account-grid">
        <aside class="sidebar-card">
          <nav class="nav-list">
            <a routerLink="profil" routerLinkActive="active" class="nav-item">
              <app-icon name="user" [size]="18" />
              <span>{{ 'Profil et adresses' | t }}</span>
            </a>

            <a routerLink="commandes" routerLinkActive="active" class="nav-item">
              <app-icon name="orders" [size]="18" />
              <span>{{ 'Mes commandes' | t }}</span>
            </a>

            <a routerLink="configurations" routerLinkActive="active" class="nav-item">
              <app-icon name="monitor" [size]="18" />
              <span>{{ 'Mes configurations' | t }}</span>
            </a>

            <button type="button" class="nav-item logout" (click)="auth.logout()">
              <app-icon name="logout" [size]="18" />
              <span>{{ 'Déconnexion' | t }}</span>
            </button>
          </nav>
        </aside>

        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: `
    .account-container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .page-title {
      font-size: var(--fs-3xl);
      font-weight: 700;
      color: var(--text);
      margin-bottom: 1.5rem;
    }

    .account-grid {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 1.5rem;
      align-items: start;
    }

    @media (max-width: 768px) {
      .account-grid {
        grid-template-columns: 1fr;
      }
    }

    .sidebar-card {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: 0.6rem;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--r-sm);
      color: var(--muted);
      text-decoration: none;
      font-size: var(--fs-md);
      font-weight: 500;
      transition: all 0.2s ease;
      background: transparent;
      border: none;
      cursor: pointer;
      width: 100%;
      text-align: left;
    }

    .nav-item:hover {
      color: var(--text);
      background: var(--surface);
    }

    .nav-item.active {
      color: var(--accent);
      background: var(--surface);
      border: 1px solid var(--accent);
      font-weight: 600;
    }

    .nav-item.logout {
      color: var(--red);
      margin-top: 0.5rem;
      border-top: 1px solid var(--border);
      border-radius: 0 0 var(--r-sm) var(--r-sm);
    }

    .nav-item.logout:hover {
      background: color-mix(in srgb, var(--red) 10%, transparent);
    }
  `,
})
export class AccountPage {
  readonly auth = inject(AuthService);
}
