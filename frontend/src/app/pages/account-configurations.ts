import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-account-configurations',
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Mes configurations enregistrées</h2>
        <button type="button" class="btn-primary" (click)="goToConfigurator()">
          + Créer une configuration
        </button>
      </div>

      @if (configurations().length === 0) {
        <div class="empty-box">
          <p class="muted">Vous n'avez pas encore de configuration enregistrée.</p>
          <button type="button" class="btn-secondary mt-2" (click)="goToConfigurator()">
            Lancer le configurateur PC
          </button>
        </div>
      } @else {
        <div class="configs-grid">
          @for (config of configurations(); track config.id) {
            <div class="config-card">
              <div class="config-top">
                <h3 class="config-name">{{ config.name }}</h3>
                <span class="config-date">Créée le {{ config.createdAt | date:'dd/MM/yyyy' }}</span>
                <strong class="config-price">{{ config.totalPrice }} TND</strong>
              </div>
              <div class="config-actions">
                <button class="btn-secondary btn-sm" (click)="loadConfig(config.id)">Charger</button>
                <button class="btn-danger btn-sm" (click)="deleteConfig(config.id)">Supprimer</button>
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
      border-radius: 14px;
      padding: 1.5rem;
    }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; }
    .card-title { font-size: 1.2rem; font-weight: 600; color: var(--text); margin: 0; }

    .btn-primary {
  background: var(--accent); 
  color: #000; 
  border: none; 
  border-radius: 99px;
  padding: 0.6rem 1.4rem; 
  font-weight: 500; /* Texte affiné (non gras) */
  font-size: 0.85rem; 
  cursor: pointer;
}
    .btn-secondary {
      background: var(--surface); color: var(--text); border: 1px solid var(--border);
      border-radius: 99px; padding: 0.5rem 1.2rem; font-weight: 500; font-size: 0.85rem; cursor: pointer;
    }

    .empty-box {
      text-align: center; padding: 3rem 1rem; border: 1px dashed var(--border);
      border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
    }
    .muted { color: var(--muted); font-size: 0.9rem; margin: 0; }

    .configs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
    .config-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem;
      display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;
    }
    .config-name { font-size: 1rem; font-weight: 600; color: var(--text); margin: 0; }
    .config-date { font-size: 0.8rem; color: var(--muted); display: block; margin-top: 0.2rem; }
    .config-price { color: var(--accent); font-size: 1.1rem; font-weight: 700; display: block; margin-top: 0.5rem; }

    .config-actions { display: flex; gap: 0.5rem; }
    .btn-sm { padding: 0.35rem 0.8rem; font-size: 0.8rem; }
    .btn-danger {
      background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 99px; font-weight: 500; cursor: pointer;
    }
  `
})
export class AccountConfigurationsPage {
  private readonly router = inject(Router);
  configurations = signal<any[]>([]);

  goToConfigurator() {
    this.router.navigate(['/configurateur']);
  }

  loadConfig(id: string) {
    this.router.navigate(['/configurateur'], { queryParams: { configId: id } });
  }

  deleteConfig(id: string) {
    this.configurations.update(list => list.filter(c => c.id !== id));
  }
}