import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AdminApiService, type StockMovement } from '../core/admin-api';
import { API_URL, type ProductDetail, type Paginated, type ProductListItem } from '../core/models';
import { TndPipe } from '../core/tnd.pipe';
import { apiErrors } from '../core/utils';
import { ProductNamePipe, TPipe, translate } from '../core/i18n';

@Component({
  standalone: true,
  selector: 'app-admin-stock',
  imports: [CommonModule, FormsModule, TndPipe, TPipe, ProductNamePipe],
  template: `
    <div class="container section">
      <h1>{{ 'Administration — Gestion des Stocks' | t }}</h1>

      @if (errorMessage()) {
        <div class="alert red" style="margin-bottom: 1rem;">{{ errorMessage() }}</div>
      }
      @if (successMessage()) {
        <div class="alert green-success" style="margin-bottom: 1rem;">{{ successMessage() }}</div>
      }

      <div class="stock-grid">
        <div class="card form-card">
          <h3>{{ "Ajuster le stock d'un produit" | t }}</h3>
          <form (ngSubmit)="onUpdateStock()" style="display: grid; gap: 1rem;">
            <div class="field">
              <label>{{ 'Recherche Produit (ID ou SKU)' | t }}</label>
              <input
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchQueryChange($event)"
                name="searchQuery"
                [placeholder]="'Entrez un ID (ex : 1) ou un SKU (ex : PCP-540664)' | t"
                required
              />
            </div>

            <div class="form-row" style="display: flex; gap: 1rem;">
              <div class="field" style="flex: 1;">
                <label>{{ 'Quantité' | t }}</label>
                <input
                  type="number"
                  min="1"
                  [(ngModel)]="rawQuantity"
                  name="rawQuantity"
                  [placeholder]="'ex : 10' | t"
                  required
                />
              </div>

              <div class="field" style="flex: 1.2;">
                <label>{{ "Motif / Type d'opération" | t }}</label>
                <select [(ngModel)]="reason" name="reason">
                  <option value="RESTOCK">{{ 'RESTOCK (+ Réapprovisionnement)' | t }}</option>
                  <option value="RETURN">{{ 'RETURN (+ Retour client)' | t }}</option>
                  <option value="SALE">{{ 'SALE (- Vente manuelle)' | t }}</option>
                  <option value="ADJUSTMENT">{{ 'ADJUSTMENT (Ajustement manuel)' | t }}</option>
                </select>
              </div>

              @if (reason === 'ADJUSTMENT') {
                <div class="field" style="flex: 1;">
                  <label>{{ 'Opération' | t }}</label>
                  <select [(ngModel)]="adjustmentDirection" name="adjustmentDirection">
                    <option value="ADD">{{ 'Ajouter (+)' | t }}</option>
                    <option value="SUBTRACT">{{ 'Retirer (-)' | t }}</option>
                  </select>
                </div>
              }
            </div>

            <div class="field">
              <label>{{ 'Note / Remarque (optionnel)' | t }}</label>
              <input
                type="text"
                [(ngModel)]="note"
                name="note"
                [placeholder]="'ex : Reçu du fournisseur X' | t"
              />
            </div>

            <button
              type="submit"
              class="btn primary block"
              [disabled]="submitting() || !selectedProduct() || !rawQuantity"
            >
              {{ (submitting() ? 'Enregistrement...' : 'Mettre à jour le stock') | t }}
            </button>
          </form>
        </div>

        <div class="card preview-card">
          <h3>{{ 'Aperçu du produit' | t }}</h3>

          @if (loadingProduct()) {
            <div class="preview-placeholder">
              <p>{{ 'Recherche du produit en cours...' | t }}</p>
            </div>
          } @else if (selectedProduct(); as prod) {
            <div class="product-preview-content">
              <div class="preview-image-box">
                @if (prod.images && prod.images.length > 0 && prod.images[0].url) {
                  <img [src]="prod.images[0].url" [alt]="prod.name | productName" />
                } @else {
                  <div class="no-img">{{ "Pas d'image" | t }}</div>
                }
              </div>
              <div class="preview-details">
                <span class="badge-brand">{{ prod.brand?.name || ('Composant' | t) }}</span>
                <h4>{{ prod.name | productName }}</h4>
                <p class="muted">
                  {{ 'ID :' | t }} <strong>#{{ prod.id }}</strong> · {{ 'SKU :' | t }}
                  <strong>{{ prod.sku }}</strong>
                </p>
                <p class="price">
                  {{ 'Prix :' | t }} <strong>{{ prod.price | tnd }}</strong>
                </p>
                <p class="stock-status">
                  {{ 'Stock actuel :' | t }}
                  <span
                    [class.text-green]="prod.stockQuantity > 0"
                    [class.text-red]="prod.stockQuantity <= 0"
                  >
                    <strong>{{ '{n} unités' | t: { n: prod.stockQuantity } }}</strong>
                  </span>
                </p>
              </div>
            </div>
          } @else {
            <div class="preview-placeholder">
              <p class="muted">
                {{ "Entrez un ID ou SKU valide pour afficher l'aperçu du produit." | t }}
              </p>
            </div>
          }
        </div>
      </div>

      <h3 style="margin-top: 2rem;">{{ 'Historique des mouvements de stock' | t }}</h3>
      @if (loadingMovements()) {
        <p>{{ 'Chargement des mouvements...' | t }}</p>
      } @else {
        <div class="card table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>{{ 'Date' | t }}</th>
                <th>{{ 'Produit' | t }}</th>
                <th>{{ 'Variation' | t }}</th>
                <th>{{ 'Motif' | t }}</th>
                <th>{{ 'Note' | t }}</th>
                <th>{{ 'Auteur' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (m of movements(); track m.id) {
                <tr>
                  <td>{{ m.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                  <td>
                    <strong>{{
                      m.product?.name
                        ? (m.product!.name | productName)
                        : ('Produit #{id}' | t: { id: m.productId })
                    }}</strong
                    ><br />
                    <small class="muted">
                      {{ 'ID :' | t }} #{{ m.productId }} · {{ 'SKU :' | t }}
                      {{ m.product?.sku || '—' }} · {{ 'Stock :' | t }}
                      <strong
                        [class.text-green]="(m.historicalStock ?? 0) > 0"
                        [class.text-red]="(m.historicalStock ?? 0) <= 0"
                      >
                        @if (m.historicalStock !== null && m.historicalStock !== undefined) {
                          {{ '{n} unités' | t: { n: m.historicalStock } }}
                        } @else {
                          —
                        }
                      </strong>
                    </small>
                  </td>
                  <td>
                    <span
                      [class.text-green]="m.quantityChange > 0"
                      [class.text-red]="m.quantityChange < 0"
                      style="font-weight: 700;"
                    >
                      {{ m.quantityChange > 0 ? '+' + m.quantityChange : m.quantityChange }}
                    </span>
                  </td>
                  <td>
                    <span
                      class="custom-badge"
                      [class.badge-green]="m.quantityChange > 0"
                      [class.badge-red]="m.quantityChange < 0"
                    >
                      {{ m.reason }}
                    </span>
                  </td>
                  <td>{{ m.note || '—' }}</td>
                  <td>{{ m.user ? m.user.firstName + ' ' + m.user.lastName : ('Système' | t) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .stock-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
      }
      @media (max-width: 768px) {
        .stock-grid {
          grid-template-columns: 1fr;
        }
      }
      .form-card,
      .preview-card {
        padding: 1.5rem;
      }
      .preview-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 220px;
        border: 2px dashed var(--border);
        border-radius: var(--r-md);
        text-align: center;
        padding: 1rem;
      }
      .product-preview-content {
        display: flex;
        gap: 1.5rem;
        align-items: center;
      }
      .preview-image-box {
        width: 140px;
        height: 140px;
        border-radius: var(--r-md);
        background: #ffffff !important; /* Fond blanc fixe quel que soit le thème */
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
        padding: 0.5rem;
        border: 1px solid var(--border);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }
      .preview-image-box img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        mix-blend-mode: normal !important; /* Affichage standard net sans assombrissement */
      }
      .preview-details {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .preview-details h4 {
        margin: 0;
        font-size: var(--fs-lg);
      }
      .table-container {
        overflow-x: auto;
      }
      .admin-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }
      .admin-table th,
      .admin-table td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--border);
      }
      .admin-table th {
        background: var(--surface-2);
        font-family: var(--font-display);
      }

      .text-green {
        color: var(--green) !important;
      }
      .text-red {
        color: var(--red) !important;
      }

      .custom-badge {
        display: inline-block;
        padding: 0.2rem 0.6rem;
        font-size: var(--fs-xs);
        font-weight: 600;
        border-radius: var(--r-lg);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .badge-green {
        background-color: color-mix(in srgb, var(--green) 12%, transparent);
        color: var(--green);
        border: 1px solid color-mix(in srgb, var(--green) 30%, transparent);
      }
      .badge-red {
        background-color: color-mix(in srgb, var(--red) 12%, transparent);
        color: var(--red);
        border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
      }
      .badge-brand {
        display: inline-block;
        background: var(--surface-2);
        color: var(--text);
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        font-size: var(--fs-sm);
        font-weight: 600;
        width: fit-content;
      }

      .alert.green-success {
        background-color: color-mix(in srgb, var(--green) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--green) 40%, transparent);
        color: var(--green);
        padding: 0.75rem 1rem;
        border-radius: var(--r-sm);
      }
    `,
  ],
})
export class AdminStockPage implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly http = inject(HttpClient);

  movements = signal<StockMovement[]>([]);
  selectedProduct = signal<ProductDetail | null>(null);
  loadingMovements = signal(true);
  loadingProduct = signal(false);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  searchQuery = signal<string>('');
  rawQuantity: number | null = null;
  reason: string = 'RESTOCK';
  adjustmentDirection: 'ADD' | 'SUBTRACT' = 'ADD';
  note: string = '';

  private debounceTimer: any = null;

  ngOnInit() {
    this.loadMovements();
  }

  onSearchQueryChange(query: string) {
    const trimmed = query.trim();
    this.searchQuery.set(trimmed);
    this.selectedProduct.set(null);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    if (!trimmed) {
      this.loadingProduct.set(false);
      return;
    }

    this.loadingProduct.set(true);
    this.debounceTimer = setTimeout(() => {
      this.fetchProductInfo(trimmed);
    }, 300);
  }

  private fetchProductInfo(query: string) {
    const isNumeric = /^\d+$/.test(query);

    if (isNumeric) {
      const id = Number.parseInt(query, 10);
      this.http.get<ProductDetail>(`${API_URL}/admin/products/${id}`).subscribe({
        next: (prod) => {
          this.selectedProduct.set(prod);
          this.loadingProduct.set(false);
        },
        error: () => {
          this.selectedProduct.set(null);
          this.loadingProduct.set(false);
        },
      });
    } else {
      this.http
        .get<Paginated<ProductListItem>>(`${API_URL}/products`, {
          params: { q: query, limit: '20' },
        })
        .subscribe({
          next: (res) => {
            const match = res.data.find((p) => p.sku.toLowerCase() === query.toLowerCase());
            if (match) {
              this.http.get<ProductDetail>(`${API_URL}/products/${match.slug}`).subscribe({
                next: (prod) => {
                  this.selectedProduct.set(prod);
                  this.loadingProduct.set(false);
                },
                error: () => {
                  this.selectedProduct.set(null);
                  this.loadingProduct.set(false);
                },
              });
            } else {
              this.selectedProduct.set(null);
              this.loadingProduct.set(false);
            }
          },
          error: () => {
            this.selectedProduct.set(null);
            this.loadingProduct.set(false);
          },
        });
    }
  }

  loadMovements() {
    this.loadingMovements.set(true);
    this.adminApi.getStockMovements().subscribe({
      next: (data) => {
        this.movements.set(data);
        this.loadingMovements.set(false);
      },
      error: (err) => {
        const msg = apiErrors(err);
        this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        this.loadingMovements.set(false);
      },
    });
  }

  onUpdateStock() {
    const prod = this.selectedProduct();
    if (!prod || !this.rawQuantity || this.rawQuantity <= 0) return;

    let finalQuantityChange = Math.abs(this.rawQuantity);
    if (this.reason === 'SALE') {
      finalQuantityChange = -finalQuantityChange;
    } else if (this.reason === 'ADJUSTMENT' && this.adjustmentDirection === 'SUBTRACT') {
      finalQuantityChange = -finalQuantityChange;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.adminApi.updateStock(prod.id, finalQuantityChange, this.reason, this.note).subscribe({
      next: () => {
        this.submitting.set(false);
        this.successMessage.set(
          translate('Stock mis à jour avec succès pour le produit #{id} ({name}) !', {
            id: prod.id,
            name: prod.name,
          }),
        );
        this.searchQuery.set('');
        this.selectedProduct.set(null);
        this.rawQuantity = null;
        this.note = '';
        this.loadMovements();
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = apiErrors(err);
        this.errorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }
}
