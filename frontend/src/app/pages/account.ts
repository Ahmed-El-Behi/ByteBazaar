import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth-service';

@Component({
  standalone: true,
  selector: 'app-account',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="account-container">
      <h1 class="page-title">Mon compte</h1>

      <div class="account-grid">
        <!-- Sidebar Navigation -->
        <aside class="sidebar-card">
          <nav class="nav-list">
            <a routerLink="profil" routerLinkActive="active" class="nav-item">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Profil et adresses</span>
            </a>

            <a routerLink="commandes" routerLinkActive="active" class="nav-item">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <span>Mes commandes</span>
            </a>

            <a routerLink="configurations" routerLinkActive="active" class="nav-item">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span>Mes configurations</span>
            </a>

            <button type="button" class="nav-item logout" (click)="auth.logout()">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Déconnexion</span>
            </button>
          </nav>
        </aside>

        <!-- Zone Principale -->
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
      font-size: 1.8rem;
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
      .account-grid { grid-template-columns: 1fr; }
    }

    .sidebar-card {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 14px;
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
      border-radius: 10px;
      color: var(--muted);
      text-decoration: none;
      font-size: 0.9rem;
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
      color: #ef4444;
      margin-top: 0.5rem;
      border-top: 1px solid var(--border);
      border-radius: 0 0 10px 10px;
    }

    .nav-item.logout:hover {
      background: rgba(239, 68, 68, 0.1);
    }
  `
})
export class AccountPage {
  readonly auth = inject(AuthService);
}