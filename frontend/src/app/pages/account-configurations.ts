import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConfigurationSummary, ConfiguratorApi } from '../core/configurator-api';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';
import { TPipe } from '../core/i18n';

@Component({
  standalone: true,
  selector: 'app-account-configurations',
  imports: [CommonModule, TndPipe, TPipe],
  template: `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{{ 'Mes configurations enregistrées' | t }}</h2>
        <button type="button" class="btn primary small" (click)="goToConfigurator()">
          {{ '+ Créer une configuration' | t }}
        </button>
      </div>

      @if (errorMessage()) {
        <p class="muted error">{{ errorMessage() }}</p>
      }

      @if (loading()) {
        <p class="muted">{{ 'Chargement de vos configurations…' | t }}</p>
      } @else if (configurations().length === 0) {
        <div class="empty-box">
          <p class="muted">{{ "Vous n'avez pas encore de configuration enregistrée." | t }}</p>
          <button type="button" class="btn small" (click)="goToConfigurator()">
            {{ 'Lancer le configurateur PC' | t }}
          </button>
        </div>
      } @else {
        <div class="configs-grid">
          @for (config of configurations(); track config.id) {
            <div class="config-card">
              <div class="config-top">
                <h3 class="config-name">{{ config.name }}</h3>
                <span class="config-date">{{
                  'Créée le {date}' | t: { date: (config.createdAt | date: 'dd/MM/yyyy') }
                }}</span>
                <strong class="config-price">{{ config.totalPrice | tnd }}</strong>
                <span class="config-date"
                  >{{ '{n} composant(s)' | t: { n: config.itemCount } }}
                  @if (config.unavailableCount) {
                    · {{ '{n} indisponible(s)' | t: { n: config.unavailableCount } }}
                  }
                </span>
              </div>
              <div class="config-actions">
                <button class="btn small" (click)="loadConfig(config.id)">
                  {{ 'Charger' | t }}
                </button>
                <button class="btn small danger-soft" (click)="deleteConfig(config.id)">
                  {{ 'Supprimer' | t }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .card {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: 1.5rem;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
    }
    .card-title {
      font-size: var(--fs-xl);
      font-weight: 600;
      color: var(--text);
      margin: 0;
    }

    .empty-box {
      text-align: center;
      padding: 3rem 1rem;
      border: 1px dashed var(--border);
      border-radius: var(--r-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    .muted {
      color: var(--muted);
      font-size: var(--fs-md);
      margin: 0;
    }
    .muted.error {
      color: var(--red);
      margin-bottom: 1rem;
    }

    .configs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }
    .config-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: 1.2rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
    }
    .config-name {
      font-size: var(--fs-base);
      font-weight: 600;
      color: var(--text);
      margin: 0;
    }
    .config-date {
      font-size: var(--fs-sm);
      color: var(--muted);
      display: block;
      margin-top: 0.2rem;
    }
    .config-price {
      color: var(--accent);
      font-size: var(--fs-lg);
      font-weight: 700;
      display: block;
      margin-top: 0.5rem;
    }

    .config-actions {
      display: flex;
      gap: 0.5rem;
    }
  `,
})
export class AccountConfigurationsPage {
  private readonly router = inject(Router);
  private readonly api = inject(ConfiguratorApi);

  readonly configurations = signal<ConfigurationSummary[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.api.list().subscribe({
      next: (list) => {
        this.configurations.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.errorMessage.set(apiErrors(e).join(' '));
        this.loading.set(false);
      },
    });
  }

  goToConfigurator() {
    this.router.navigate(['/configurateur']);
  }

  loadConfig(id: number) {
    this.router.navigate(['/configurateur'], { queryParams: { configId: id } });
  }

  deleteConfig(id: number) {
    this.errorMessage.set(null);
    this.api.delete(id).subscribe({
      next: () => this.configurations.update((list) => list.filter((c) => c.id !== id)),
      error: (e) => this.errorMessage.set(apiErrors(e).join(' ')),
    });
  }
}
