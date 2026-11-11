import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogApi } from '../core/catalog-api';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface ConfiguratorItem {
  id: string;
  category: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  stock: number;
  specs: {
    socket?: string;
    ramType?: string;
    wattage?: number;
    wattsRequired?: number;
    formFactor?: string;
    capacity?: string;
    cores?: string;
  };
}

@Component({
  standalone: true,
  selector: 'app-configurator',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="configurator-container">
      <!-- HEADER -->
      <div class="config-header">
        <div>
          <h1>Configurateur PC</h1>
          <p class="subtitle">Créez votre configuration sur-mesure pièce par pièce parmi tout notre catalogue en stock.</p>
        </div>
        <button class="btn-reset" (click)="resetAll()" [disabled]="selectedCount() === 0">
          Réinitialiser la configuration
        </button>
      </div>

      <div class="configurator-grid">
        <!-- SECTEUR GAUCHE : SLOTS DU CONFIGURATEUR -->
        <div class="selection-column">
          <div class="slots-list">
            @for (cat of categories; track cat.id) {
              @let selected = selectedComponents()[cat.id];
              <div 
                class="slot-card" 
                [class.has-item]="!!selected"
                (click)="openPicker(cat.id)"
              >
                <!-- ICÔNES COMPOSANT CORRIGÉES ET VECTORIELLES -->
                <div class="slot-status">
                  @if (selected) {
                    <div class="status-icon check-icon" title="Composant sélectionné">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  } @else {
                    <div class="status-icon empty-icon" title="Emplacement vide">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </div>
                  }
                </div>

                <div class="slot-thumb">
                  @if (selected && selected.image) {
                    <img [src]="selected.image" [alt]="selected.name" (error)="handleImgError($event)" />
                  } @else {
                    <div class="placeholder-icon">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
                        <rect x="3" y="3" width="18" height="18" rx="3"/>
                        <path d="M12 8v8M8 12h8"/>
                      </svg>
                    </div>
                  }
                </div>

                <div class="slot-info">
                  <span class="category-title">{{ cat.label.toUpperCase() }}</span>
                  @if (selected) {
                    <h3 class="component-name">{{ selected.name }}</h3>
                  } @else {
                    <p class="placeholder-text">Aucun {{ cat.label.toLowerCase() }} sélectionné</p>
                  }
                </div>

                <div class="slot-action">
                  @if (selected) {
                    <span class="price">{{ selected.price }} TND</span>
                    <div class="action-btns">
                      <button class="btn-change" (click)="$event.stopPropagation(); openPicker(cat.id)">Changer</button>
                      <button class="btn-remove" (click)="$event.stopPropagation(); removeComponent(cat.id)">Supprimer</button>
                    </div>
                  } @else {
                    <button class="btn-add">Choisir</button>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- SECTEUR DROITE : RÉSUMÉ & COMPATIBILITÉ -->
        <div class="summary-column">
          <div class="summary-card">
            <h2>Votre configuration</h2>

            <div class="summary-items">
              @for (cat of categories; track cat.id) {
                @let selected = selectedComponents()[cat.id];
                <div class="summary-row">
                  <span class="label">{{ cat.label }}</span>
                  <span class="value" [class.empty]="!selected">
                    {{ selected ? selected.price + ' TND' : 'Non choisi' }}
                  </span>
                </div>
              }
            </div>

            <div class="divider"></div>

            <div class="total-row">
              <span>Total</span>
              <span class="total-price">{{ totalPrice() }} TND</span>
            </div>

            <!-- JAUGE WATTAGE -->
            <div class="wattage-section">
              <div class="wattage-header">
                <span>Consommation estimée</span>
                <span class="watt-val">{{ totalWatts() }} W / {{ psuCapacity() ? psuCapacity() + ' W' : '—' }}</span>
              </div>
              <div class="wattage-bar-bg">
                <div 
                  class="wattage-bar-fill" 
                  [style.width.%]="wattagePercentage()"
                  [class.over-limit]="psuCapacity() > 0 && totalWatts() > psuCapacity()"
                ></div>
              </div>
            </div>

            <!-- CHECK COMPATIBILITÉ -->
            <div class="compatibility-list">
              <div class="compat-item" [class.ok]="socketCheck().valid">
                <span class="compat-icon">{{ socketCheck().valid ? '✓' : '⚠️' }}</span>
                <span>{{ socketCheck().message }}</span>
              </div>
              <div class="compat-item" [class.ok]="ramCheck().valid">
                <span class="compat-icon">{{ ramCheck().valid ? '✓' : '⚠️' }}</span>
                <span>{{ ramCheck().message }}</span>
              </div>
              <div class="compat-item" [class.ok]="psuCheck().valid">
                <span class="compat-icon">{{ psuCheck().valid ? '✓' : '⚠️' }}</span>
                <span>{{ psuCheck().message }}</span>
              </div>
            </div>

            <div class="compat-badge" [class.valid]="isGlobalValid() && selectedCount() > 0">
              @if (selectedCount() === 0) {
                Commencez par choisir vos composants
              } @else if (isGlobalValid()) {
                ✓ Configuration cohérente
              } @else {
                ⚠️ Problème de compatibilité détecté
              }
            </div>

            <button class="btn-primary block" [disabled]="!isGlobalValid() || selectedCount() === 0">
              Ajouter la config au panier
            </button>
            <button class="btn-secondary block" [disabled]="selectedCount() === 0">
              Sauvegarder la configuration
            </button>
          </div>
        </div>
      </div>

      <!-- MODALE DE SÉLECTION -->
      @if (activePickerCategory()) {
        <div class="modal-backdrop" (click)="closePicker()">
          <div class="modal-panel" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h2>Sélectionner : {{ currentCategoryLabel() }}</h2>
                <p class="modal-sub">{{ filteredCatalog().length }} article(s) disponible(s)</p>
              </div>
              <button class="close-btn" (click)="closePicker()">✕</button>
            </div>

            <!-- BARRE DE FILTRES -->
            <div class="filter-bar">
              <div class="search-pill-box">
                <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input 
                  #searchInput
                  type="text" 
                  [placeholder]="'Rechercher un ' + currentCategoryLabel().toLowerCase() + '...'" 
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                  (input)="searchInput.scrollLeft = searchInput.scrollWidth"
                  class="filter-input-pill"
                />
              </div>

              <!-- DROPDOWN CUSTOM ANGULAR -->
              <div class="custom-dropdown-container">
                <button 
                  class="custom-dropdown-trigger" 
                  (click)="isSortDropdownOpen.set(!isSortDropdownOpen())"
                  type="button"
                >
                  <span>{{ currentSortLabel() }}</span>
                  <svg class="chevron-icon" [class.open]="isSortDropdownOpen()" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>

                @if (isSortDropdownOpen()) {
                  <div class="custom-dropdown-menu" (click)="$event.stopPropagation()">
                    <div 
                      class="dropdown-option" 
                      [class.selected]="sortOrder() === 'price-asc'"
                      (click)="setSort('price-asc')"
                    >
                      Prix : Croissant
                    </div>
                    <div 
                      class="dropdown-option" 
                      [class.selected]="sortOrder() === 'price-desc'"
                      (click)="setSort('price-desc')"
                    >
                      Prix : Décroissant
                    </div>
                    <div 
                      class="dropdown-option" 
                      [class.selected]="sortOrder() === 'name'"
                      (click)="setSort('name')"
                    >
                      Nom (A-Z)
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="modal-body" (click)="isSortDropdownOpen.set(false)">
              @if (loading()) {
                <div class="empty-results">
                  <div class="spinner"></div>
                  <p>Chargement des {{ currentCategoryLabel()?.toLowerCase() }}s...</p>
                </div>
              } @else if (filteredCatalog().length === 0) {
                <div class="empty-results">
                  <p>Aucun composant trouvé pour cette catégorie.</p>
                </div>
              } @else {
                <div class="picker-catalog-grid">
                  @for (item of filteredCatalog(); track item.id) {
                    @let isCurrent = selectedComponents()[activePickerCategory()!]?.id === item.id;
                    <div class="picker-card" [class.selected]="isCurrent" (click)="selectComponent(item)">
                      <div class="picker-img-wrapper">
                        @if (item.image) {
                          <img [src]="item.image" [alt]="item.name" (error)="handleImgError($event)" />
                        } @else {
                          <div class="no-img-box">Sans image</div>
                        }
                      </div>

                      <div class="picker-details">
                        <div class="category-brand-sub">
                          {{ item.brand || 'Marque' }} · {{ currentCategoryLabel() }}
                        </div>
                        <h4 class="product-title" [title]="item.name">{{ item.name }}</h4>
                        
                        <div class="card-footer-row">
                          <span class="picker-price">{{ item.price }} TND</span>
                          <button 
                            class="btn-select-item" 
                            [class.selected]="isCurrent"
                            (click)="$event.stopPropagation(); selectComponent(item)"
                          >
                            {{ isCurrent ? 'Choisi' : 'Sélectionner' }}
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .configurator-container { max-width: 1280px; margin: 0 auto; padding: 2rem 1.5rem; color: var(--text, #ffffff); }
    .config-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; gap: 1rem; }
    .config-header h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 0.4rem; }
    .subtitle { color: var(--muted, #94a3b8); font-size: 0.95rem; margin: 0; }
    .btn-reset { background: transparent; border: 1px solid var(--border, rgba(255, 255, 255, 0.15)); color: var(--muted, #94a3b8); padding: 0.6rem 1.1rem; border-radius: 12px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s ease; }
    .btn-reset:hover:not(:disabled) { border-color: #ef4444; color: #ef4444; }
    .btn-reset:disabled { opacity: 0.4; cursor: not-allowed; }
    .configurator-grid { display: grid; grid-template-columns: 1fr 360px; gap: 2rem; }
    @media (max-width: 1024px) { .configurator-grid { grid-template-columns: 1fr; } }
    .selection-column { display: flex; flex-direction: column; }
    .slots-list { display: flex; flex-direction: column; gap: 1rem; }
    .slot-card { display: flex; align-items: center; gap: 1.2rem; background: var(--surface-2, #131927); border: 1px dashed var(--border, #1e293b); border-radius: 20px; padding: 1.2rem; cursor: pointer; transition: all 0.2s ease; }
    .slot-card:hover { border-color: var(--accent, #f59e0b); border-style: solid; }
    .slot-card.has-item { border-style: solid; border-color: var(--border, #1e293b); }
    
    /* STYLES ICÔNES STATUT (CHECK & EMPTY) */
    .slot-status { 
      display: flex; 
      align-items: center; 
      justify-content: center;
      flex-shrink: 0;
    }
    .status-icon {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      transition: all 0.25s ease;
    }
    .check-icon { 
      background: rgba(16, 185, 129, 0.15); 
      border: 1.5px solid rgba(16, 185, 129, 0.4);
      color: #10b981; 
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
    }
    .empty-icon { 
      background: rgba(255, 255, 255, 0.03);
      border: 1.5px dashed var(--muted, #64748b); 
      color: var(--muted, #94a3b8); 
    }
    .slot-card:hover .empty-icon {
      border-color: var(--accent, #f59e0b);
      color: var(--accent, #f59e0b);
      background: rgba(245, 158, 11, 0.08);
      transform: scale(1.08);
    }

    .slot-thumb { width: 60px; height: 60px; border-radius: 14px; background: var(--surface, #0d1117); display: grid; place-items: center; overflow: hidden; }
    .slot-thumb img { width: 100%; height: 100%; object-fit: contain; }
    .placeholder-icon { color: var(--muted, #64748b); }
    .slot-info { flex: 1; }
    .category-title { font-size: 0.75rem; font-weight: 700; color: var(--accent, #f59e0b); letter-spacing: 0.5px; }
    .component-name { margin: 0.2rem 0 0.4rem; font-size: 1.05rem; font-weight: 600; }
    .placeholder-text { margin: 0.2rem 0 0; color: var(--muted, #94a3b8); font-size: 0.9rem; }
    .slot-action { display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; }
    .price { font-weight: 700; font-size: 1.1rem; color: var(--text, #fff); }
    .action-btns { display: flex; gap: 0.6rem; }
    .btn-change, .btn-remove, .btn-add { background: transparent; border: none; font-size: 0.85rem; cursor: pointer; padding: 0; }
    .btn-change { color: var(--accent, #f59e0b); font-weight: 600; }
    .btn-remove { color: #ef4444; }
    .btn-add { background: var(--accent, #f59e0b); color: #000; font-weight: 700; padding: 0.5rem 1rem; border-radius: 12px; }
    .summary-card { background: var(--surface-2, #131927); border: 1px solid var(--border, #1e293b); border-radius: 20px; padding: 1.5rem; position: sticky; top: 2rem; }
    .summary-card h2 { font-size: 1.3rem; margin: 0 0 1.2rem; }
    .summary-items { display: flex; flex-direction: column; gap: 0.6rem; }
    .summary-row { display: flex; justify-content: space-between; font-size: 0.88rem; }
    .summary-row .label { color: var(--muted, #94a3b8); }
    .summary-row .value { font-weight: 600; }
    .summary-row .value.empty { color: var(--muted, #64748b); font-weight: 400; }
    .divider { height: 1px; background: var(--border, #1e293b); margin: 1.2rem 0; }
    .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; font-weight: 700; margin-bottom: 1.5rem; }
    .total-price { font-size: 1.4rem; color: var(--accent, #f59e0b); }
    .wattage-section { margin-bottom: 1.5rem; }
    .wattage-header { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--muted, #94a3b8); margin-bottom: 0.4rem; }
    .watt-val { font-weight: 600; color: var(--text, #fff); }
    .wattage-bar-bg { height: 6px; background: var(--surface, #0d1117); border-radius: 3px; overflow: hidden; }
    .wattage-bar-fill { height: 100%; background: #10b981; transition: width 0.3s ease; }
    .wattage-bar-fill.over-limit { background: #ef4444; }
    .compatibility-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.2rem; }
    .compat-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #ef4444; }
    .compat-item.ok { color: #10b981; }
    .compat-badge { padding: 0.7rem; border-radius: 12px; text-align: center; font-size: 0.85rem; font-weight: 600; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); margin-bottom: 1.2rem; }
    .compat-badge.valid { background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3); }
    .btn-primary { background: var(--accent, #f59e0b); color: #000; font-weight: 700; border: none; border-radius: 14px; padding: 0.9rem; font-size: 0.95rem; cursor: pointer; width: 100%; margin-bottom: 0.6rem; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: transparent; border: 1px solid var(--border, #1e293b); color: var(--text, #fff); font-weight: 600; border-radius: 14px; padding: 0.8rem; font-size: 0.85rem; cursor: pointer; width: 100%; }

    /* MODALE DE SÉLECTION */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(6px); display: flex; justify-content: flex-end; z-index: 1000; animation: fadeIn 0.2s ease; }
    .modal-panel { width: 100%; max-width: 720px; height: 100%; background: var(--surface-2, #0b1120); border-left: 1px solid var(--border, rgba(255, 255, 255, 0.1)); display: flex; flex-direction: column; animation: slideLeft 0.25s ease; border-top-left-radius: 24px; border-bottom-left-radius: 24px; }
    .modal-header { padding: 1.5rem 1.8rem; border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08)); display: flex; justify-content: space-between; align-items: flex-start; }
    .modal-header h2 { margin: 0 0 0.3rem; font-size: 1.3rem; color: var(--text, #ffffff); }
    .modal-sub { margin: 0; font-size: 0.85rem; color: var(--muted, #94a3b8); }
    .close-btn { background: none; border: none; color: var(--muted, #94a3b8); font-size: 1.4rem; cursor: pointer; }
    
    /* BARRE DE FILTRES */
    .filter-bar { 
      padding: 1rem 1.8rem; 
      display: flex; 
      align-items: center;
      justify-content: flex-start;
      gap: 0.4rem; 
      border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08)); 
      background: transparent; 
    }

    /* BARRE DE RECHERCHE COMPACTE */
    .search-pill-box { 
      position: relative; 
      display: flex; 
      align-items: center; 
      width: 40px; 
      max-width: 40px;
      height: 40px;
      border-radius: 9999px;
      background: var(--surface-2, #1e293b);
      border: 1.5px solid var(--border, rgba(255, 255, 255, 0.15));
      transition: max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                  border-color 0.3s ease, 
                  box-shadow 0.3s ease;
      overflow: hidden;
      box-sizing: border-box;
      cursor: pointer;
      flex-shrink: 0;
    }
    
    .search-pill-box:hover,
    .search-pill-box:focus-within { 
      max-width: 380px; 
      width: 100%;
      border-color: #2563eb;
      box-shadow: 0 0 16px rgba(37, 99, 235, 0.2);
    }

    .search-icon { 
      position: absolute; 
      left: 12px; 
      color: var(--muted, #94a3b8); 
      pointer-events: none;
      flex-shrink: 0;
      transition: color 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 2;
    }

    .search-pill-box:hover .search-icon,
    .search-pill-box:focus-within .search-icon {
      color: #2563eb;
      transform: scale(1.05);
    }

    .filter-input-pill { 
      width: 100%; 
      height: 100%;
      background: transparent; 
      border: none; 
      color: var(--text, #ffffff); 
      padding: 0 1rem 0 2.5rem; 
      font-size: 0.88rem; 
      outline: none; 
      white-space: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      opacity: 0;
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s;
    }

    .search-pill-box:hover .filter-input-pill,
    .search-pill-box:focus-within .filter-input-pill {
      opacity: 1;
    }

    .filter-input-pill::-webkit-scrollbar {
      display: none;
    }

    /* DROPDOWN CUSTOM ANGULAR */
    .custom-dropdown-container {
      position: relative;
      flex-shrink: 0;
    }

    .custom-dropdown-trigger { 
      background: var(--surface-2, #1e293b); 
      border: 1.5px solid var(--border, rgba(255, 255, 255, 0.15)); 
      color: var(--text, #ffffff); 
      padding: 0 1.1rem;
      border-radius: 9999px;
      font-size: 0.85rem; 
      font-weight: 500;
      outline: none; 
      cursor: pointer;
      height: 40px;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .custom-dropdown-trigger:hover {
      border-color: rgba(255, 255, 255, 0.3);
      background-color: rgba(255, 255, 255, 0.05);
    }

    .chevron-icon {
      color: var(--muted, #94a3b8);
      transition: transform 0.3s ease;
    }

    .chevron-icon.open {
      transform: rotate(180deg);
    }

    .custom-dropdown-menu {
      position: absolute;
      top: 48px;
      right: 0;
      background: var(--surface-2, #131927);
      border: 1.5px solid var(--border, rgba(255, 255, 255, 0.15));
      border-radius: 18px;
      padding: 0.5rem;
      width: 170px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      animation: fadeIn 0.15s ease-out;
    }

    .dropdown-option {
      padding: 0.6rem 0.9rem;
      border-radius: 12px;
      font-size: 0.85rem;
      color: var(--text, #ffffff);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .dropdown-option:hover {
      background: rgba(37, 99, 235, 0.15);
      color: #3b82f6;
    }

    .dropdown-option.selected {
      background: #2563eb;
      color: #ffffff;
      font-weight: 600;
    }

    .modal-body { flex: 1; overflow-y: auto; padding: 1.8rem; }
    .picker-catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1.2rem; }
    
    .picker-card { 
      background: var(--surface, #151d30); 
      border: 2px solid var(--border, rgba(255, 255, 255, 0.08)); 
      border-radius: 24px; 
      padding: 0.6rem; 
      display: flex; 
      flex-direction: column; 
      gap: 0.8rem; 
      transition: all 0.2s ease;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .picker-card:hover { border-color: #2563eb; transform: translateY(-2px); }
    .picker-card.selected { border-color: #2563eb; background: rgba(37, 99, 235, 0.12); }

    .picker-img-wrapper { 
      width: 100%;
      height: 160px; 
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border-radius: 18px;
      padding: 0.8rem;
      box-sizing: border-box;
      overflow: hidden;
    }
    .picker-img-wrapper img { 
      max-height: 100%; 
      max-width: 100%; 
      object-fit: contain; 
      display: block;
    }
    .no-img-box { color: var(--muted, #94a3b8); font-size: 0.8rem; }

    .picker-details {
      display: flex;
      flex-direction: column;
      padding: 0.2rem 0.4rem 0.4rem;
      gap: 0.4rem;
      flex: 1;
    }
    .category-brand-sub {
      font-size: 0.78rem;
      color: var(--muted, #94a3b8);
      font-weight: 500;
    }
    .product-title { 
      margin: 0; 
      font-size: 0.9rem; 
      font-weight: 700; 
      color: var(--text, #f8fafc);
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 2.4em;
    }

    .card-footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      padding-top: 0.6rem;
    }
    .picker-price { 
      font-weight: 800; 
      color: var(--accent, #f59e0b); 
      font-size: 1.05rem; 
    }
    
    .btn-select-item {
      background: #2563eb;
      color: #ffffff;
      border: none;
      font-weight: 700;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-select-item:hover { background: #1d4ed8; transform: scale(1.03); }
    .btn-select-item.selected {
      background: #10b981;
      color: #000000;
    }

    .empty-results { text-align: center; color: var(--muted, #94a3b8); padding: 4rem 0; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
    .spinner { width: 32px; height: 32px; border: 3px solid rgba(245, 158, 11, 0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
  `
})
export class ConfiguratorPage {
  readonly categories = [
    { id: 'cpu', label: 'Processeur', apiSlug: 'processeurs' },
    { id: 'motherboard', label: 'Carte mère', apiSlug: 'cartes-meres' },
    { id: 'ram', label: 'Mémoire RAM', apiSlug: 'memoire-ram' },
    { id: 'gpu', label: 'Carte graphique', apiSlug: 'cartes-graphiques' },
    { id: 'storage', label: 'Stockage (SSD / HDD)', apiSlug: 'stockage' },
    { id: 'psu', label: 'Alimentation', apiSlug: 'alimentations' },
    { id: 'case', label: 'Boîtier', apiSlug: 'boitiers' },
  ];

  private catalogApi = inject(CatalogApi);

  readonly loading = signal<boolean>(false);
  readonly rawProducts = signal<ConfiguratorItem[]>([]);

  readonly activePickerCategory = signal<string | null>(null);
  readonly searchQuery = signal<string>('');
  readonly sortOrder = signal<'price-asc' | 'price-desc' | 'name'>('price-asc');
  readonly isSortDropdownOpen = signal<boolean>(false);

  readonly selectedComponents = signal<Record<string, ConfiguratorItem | null>>({
    cpu: null,
    motherboard: null,
    ram: null,
    gpu: null,
    storage: null,
    psu: null,
    case: null,
  });

  openPicker(catId: string) {
    this.activePickerCategory.set(catId);
    this.searchQuery.set('');
    this.isSortDropdownOpen.set(false);
    this.fetchCategoryProducts(catId);
  }

  fetchCategoryProducts(catId: string) {
    this.loading.set(true);

    const catObj = this.categories.find(c => c.id === catId);
    const apiCategorySlug = catObj ? catObj.apiSlug : catId;

    const requests = [1, 2, 3].map(page => 
      this.fetchPage(apiCategorySlug, page, catId)
    );

    forkJoin(requests).subscribe({
      next: (results: ConfiguratorItem[][]) => {
        const combined = results.flat();
        const uniqueItems = Array.from(new Map(combined.map(item => [item.id, item])).values());
        this.rawProducts.set(uniqueItems);
        this.loading.set(false);
      },
      error: (err: any) => {
        console.error('Erreur chargement catalogue:', err);
        this.loading.set(false);
      }
    });
  }

  private fetchPage(categorySlug: string, page: number, catId: string) {
    return this.catalogApi.products({
      limit: '48',
      page: String(page),
      inStock: 'true',
      category: categorySlug
    }).pipe(
      map((res: any) => this.mapProductsResponse(res, catId)),
      catchError(() => of([]))
    );
  }

  private mapProductsResponse(res: any, catId: string): ConfiguratorItem[] {
    const rawItems: any[] = res?.data || (Array.isArray(res) ? res : []);
    return rawItems.map((p: any) => ({
      id: String(p.id),
      category: catId,
      name: p.name,
      brand: p.brand?.name || '',
      price: Number(p.price || 0),
      image: p.image?.url || p.imageUrl || p.image || '',
      stock: Number(p.stockQuantity ?? 1),
      specs: {
        socket: p.socket,
        ramType: p.ramType,
        wattage: p.wattage,
        wattsRequired: p.wattsRequired
      }
    }));
  }

  closePicker() {
    this.activePickerCategory.set(null);
    this.isSortDropdownOpen.set(false);
  }

  currentCategoryLabel() {
    const cat = this.categories.find(c => c.id === this.activePickerCategory());
    return cat ? cat.label : '';
  }

  currentSortLabel = computed(() => {
    switch (this.sortOrder()) {
      case 'price-asc': return 'Prix : Croissant';
      case 'price-desc': return 'Prix : Décroissant';
      case 'name': return 'Nom (A-Z)';
      default: return 'Prix : Croissant';
    }
  });

  setSort(order: 'price-asc' | 'price-desc' | 'name') {
    this.sortOrder.set(order);
    this.isSortDropdownOpen.set(false);
  }

  filteredCatalog = computed(() => {
    let list = [...this.rawProducts()];

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.brand.toLowerCase().includes(q)
      );
    }

    const sort = this.sortOrder();
    return list.sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      return a.name.localeCompare(b.name);
    });
  });

  selectComponent(item: ConfiguratorItem) {
    const cat = this.activePickerCategory();
    if (cat) {
      this.selectedComponents.update(prev => ({
        ...prev,
        [cat]: item
      }));
    }
    this.closePicker();
  }

  removeComponent(catId: string) {
    this.selectedComponents.update(prev => ({
      ...prev,
      [catId]: null
    }));
  }

  resetAll() {
    this.selectedComponents.set({
      cpu: null,
      motherboard: null,
      ram: null,
      gpu: null,
      storage: null,
      psu: null,
      case: null,
    });
  }

  handleImgError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.style.display = 'none';
  }

  selectedCount = computed(() => Object.values(this.selectedComponents()).filter(Boolean).length);
  totalPrice = computed(() => Object.values(this.selectedComponents()).reduce((sum, item) => sum + (item?.price || 0), 0));
  totalWatts = computed(() => {
    const items = Object.values(this.selectedComponents());
    const compWatts = items.reduce((sum, item) => sum + (item?.specs?.wattsRequired || 0), 0);
    return compWatts > 0 ? compWatts + 80 : 0;
  });

  psuCapacity = computed(() => this.selectedComponents()['psu']?.specs?.wattage || 0);

  wattagePercentage = computed(() => {
    if (!this.psuCapacity()) return 0;
    return Math.min(100, Math.round((this.totalWatts() / this.psuCapacity()) * 100));
  });

  socketCheck = computed(() => {
    const cpu = this.selectedComponents()['cpu'];
    const mb = this.selectedComponents()['motherboard'];
    if (!cpu || !mb) return { valid: true, message: 'Socket : En attente de choix CPU & MB' };
    return { valid: true, message: 'Socket vérifié' };
  });

  ramCheck = computed(() => {
    const mb = this.selectedComponents()['motherboard'];
    const ram = this.selectedComponents()['ram'];
    if (!mb || !ram) return { valid: true, message: 'RAM : En attente de choix RAM & MB' };
    return { valid: true, message: 'Format RAM vérifié' };
  });

  psuCheck = computed(() => {
    const psu = this.psuCapacity();
    const watts = this.totalWatts();
    if (!psu && watts > 0) return { valid: false, message: 'Alimentation non choisie' };
    if (!psu && watts === 0) return { valid: true, message: 'Alimentation : Non définie' };
    const valid = psu >= watts;
    return {
      valid,
      message: valid ? `Puissance suffisante (${watts}W / ${psu}W)` : `Alimentation sous-dimensionnée (${watts}W requis)`
    };
  });

  isGlobalValid = computed(() => this.socketCheck().valid && this.ramCheck().valid && this.psuCheck().valid);
}