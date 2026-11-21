import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from './icon';
import { TPipe } from '../core/i18n';

/** Onglets de l'espace d'administration (tableau de bord, commandes, stock) */
@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, RouterLinkActive, Icon, TPipe],
  template: `
    <nav class="admin-nav" [attr.aria-label]="'Administration' | t">
      <a routerLink="/admin" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">
        <app-icon name="dashboard" [size]="16" /> {{ 'Tableau de bord' | t }}
      </a>
      <a routerLink="/admin/commandes" routerLinkActive="on">
        <app-icon name="orders" [size]="16" /> {{ 'Commandes' | t }}
      </a>
      <a routerLink="/admin/stock" routerLinkActive="on">
        <app-icon name="package" [size]="16" /> {{ 'Stock' | t }}
      </a>
    </nav>
  `,
  styles: `
    .admin-nav {
      display: flex;
      gap: 0.3rem;
      width: fit-content;
      max-width: 100%;
      margin-bottom: 1.4rem;
      padding: 0.3rem;
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      box-shadow: var(--shadow-sm);
      scrollbar-width: none;
    }
    a {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.95rem;
      border-radius: 999px;
      color: var(--muted);
      font-size: var(--fs-md);
      font-weight: 600;
      white-space: nowrap;
    }
    a:hover {
      color: var(--text);
      background: var(--surface-2);
    }
    a.on {
      color: var(--on-accent);
      background: var(--accent);
    }
  `,
})
export class AdminNav {}
