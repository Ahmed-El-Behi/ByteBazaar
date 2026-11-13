import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Icon } from '../components/icon';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { concat, distinctUntilChanged, of, switchMap, toArray } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../core/auth-service';
import { CartStateService } from '../core/cart.service';
import { BuildCheck, ConfiguratorApi, ConfiguratorPart, Slot } from '../core/configurator-api';
import { apiErrors } from '../core/utils';
import { PcScene } from '../components/pc-scene';
import { I18nService, ProductNamePipe, TPipe, translate } from '../core/i18n';

const STORAGE_KEY = 'bytebazaar_configurator';
const EMPTY_SELECTION: Record<Slot, ConfiguratorPart | null> = {
  cpu: null,
  cooler: null,
  motherboard: null,
  ram: null,
  gpu: null,
  storage: null,
  psu: null,
  case: null,
  monitor: null,
  keyboard: null,
  mouse: null,
  headset: null,
};

interface StoredBuild {
  ids: number[];
  configId: number | null;
  name: string;
}

@Component({
  standalone: true,
  selector: 'app-configurator',
  imports: [Icon, CommonModule, FormsModule, PcScene, TPipe, ProductNamePipe],
  template: `
    <div class="configurator-container">
      <!-- HEADER -->
      <div class="config-header">
        <div>
          <h1>{{ 'Configurateur PC' | t }}</h1>
          <p class="subtitle">{{ 'Créez votre configuration sur-mesure pièce par pièce parmi tout notre catalogue en stock.' | t }}</p>
        </div>
        <button class="btn-reset" (click)="resetAll()" [disabled]="selectedCount() === 0">
          {{ 'Réinitialiser la configuration' | t }}
        </button>
      </div>

      <div class="configurator-grid">
        <!-- SECTEUR GAUCHE : PC 3D INTERACTIF -->
        <div class="selection-column">
          <app-pc-scene
            [selection]="selectedComponents()"
            [labels]="slotLabels"
            [highlighted]="highlightedSlot()"
            (pick)="openPicker($event)"
            (hoverChange)="highlightedSlot.set($event)"
          />

          <!-- Mêmes actions sans la 3D : clavier, lecteurs d'écran, tactile -->
          @for (group of chipGroups; track group.title) {
          <h3 class="chips-title">{{ group.title | t }}</h3>
          <div class="slot-chips">
            @for (cat of group.slots; track cat.id) {
              @let selected = selectedComponents()[cat.id];
              <div
                class="slot-chip"
                [class.filled]="!!selected"
                [class.active]="highlightedSlot() === cat.id"
                (mouseenter)="highlightedSlot.set(cat.id)"
                (mouseleave)="highlightedSlot.set(null)"
              >
                <button type="button" class="chip-main" (click)="openPicker(cat.id)" (focus)="highlightedSlot.set(cat.id)" (blur)="highlightedSlot.set(null)">
                  <span class="chip-label">{{ cat.label | t }}</span>
                  <span class="chip-value">{{ selected ? (selected.name | productName) : ('Choisir' | t) }}</span>
                </button>
                @if (selected) {
                  <button type="button" class="chip-remove" (click)="removeComponent(cat.id)" [attr.aria-label]="('Retirer :' | t) + ' ' + (selected.name | productName)" [title]="'Retirer' | t"><app-icon name="close" [size]="15" /></button>
                }
              </div>
            }
          </div>
          }
        </div>

        <!-- SECTEUR DROITE : RÉSUMÉ & COMPATIBILITÉ -->
        <div class="summary-column">
          <div class="summary-card">
            <h2>{{ 'Votre configuration' | t }}</h2>

            <div class="summary-items">
              @for (cat of categories; track cat.id) {
                @let selected = selectedComponents()[cat.id];
                <div class="summary-row" [class.active]="highlightedSlot() === cat.id" (mouseenter)="highlightedSlot.set(cat.id)" (mouseleave)="highlightedSlot.set(null)" (click)="openPicker(cat.id)">
                  <span class="label">{{ cat.label | t }}</span>
                  <span class="value" [class.empty]="!selected">
                    {{ selected ? selected.price + ' TND' : ('Non choisi' | t) }}
                  </span>
                </div>
              }
            </div>

            <div class="divider"></div>

            <div class="total-row">
              <span>{{ 'Total' | t }}</span>
              <span class="total-price">{{ totalPrice() }} TND</span>
            </div>

            <!-- JAUGE WATTAGE -->
            <div class="wattage-section">
              <div class="wattage-header">
                <span>{{ 'Consommation estimée' | t }}</span>
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

            <!-- CHECK COMPATIBILITÉ (calculé par le serveur) -->
            <div class="compatibility-list">
              @for (check of checks(); track check.id) {
                <div class="compat-item" [class.ok]="check.status === 'ok'" [class.pending]="check.status === 'pending'" [class.warn]="check.status === 'warning'">
                  <app-icon class="compat-icon" [name]="check.status === 'ok' ? 'check' : check.status === 'pending' ? 'circleDashed' : 'warning'" [size]="15" [stroke]="2" />
                  <span>{{ check.message }}</span>
                </div>
              }
            </div>

            <div class="compat-badge" [class.valid]="isGlobalValid() && selectedCount() > 0">
              @if (selectedCount() === 0) {
                {{ 'Commencez par choisir vos composants' | t }}
              } @else if (isGlobalValid()) {
                <app-icon name="checkCircle" [size]="17" /> {{ 'Configuration cohérente' | t }}
              } @else {
                <app-icon name="warning" [size]="17" /> {{ 'Problème de compatibilité détecté' | t }}
              }
            </div>

            <button class="btn-primary block" [disabled]="!isGlobalValid() || selectedCount() === 0 || busy()" (click)="addToCart()">
              {{ 'Ajouter la config au panier' | t }}
            </button>
            <button class="btn-secondary block" [disabled]="!isGlobalValid() || selectedCount() === 0 || busy()" (click)="openSave()">
              {{ (configId() ? 'Mettre à jour la configuration' : 'Sauvegarder la configuration') | t }}
            </button>

            @if (saveOpen()) {
              <form class="save-form" (submit)="$event.preventDefault(); save()">
                <input
                  class="save-input"
                  [ngModel]="configName()"
                  (ngModelChange)="configName.set($event)"
                  name="configName"
                  maxlength="80"
                  [placeholder]="'Nom de la configuration' | t"
                  required
                />
                <button type="submit" class="btn-select-item" [disabled]="!configName().trim() || busy()">{{ 'Enregistrer' | t }}</button>
              </form>
            }

            @if (actionMessage(); as msg) {
              <p class="action-msg" [class.error]="msg.type === 'error'">{{ msg.text }}</p>
            }
          </div>
        </div>
      </div>

      <!-- MODALE DE SÉLECTION -->
      @if (activePickerCategory()) {
        <div class="modal-backdrop" (click)="closePicker()">
          <div class="modal-panel" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h2>{{ 'Sélectionner :' | t }} {{ currentCategoryLabel() | t }}</h2>
                <p class="modal-sub">
                  {{ '{n} article(s) compatible(s) en stock' | t: { n: filteredCatalog().length } }}
                  @if (hiddenCount() > 0) { · {{ '{n} masqué(s) car incompatible(s) avec votre sélection' | t: { n: hiddenCount() } }} }
                </p>
              </div>
              <button class="close-btn" (click)="closePicker()" [attr.aria-label]="'Fermer' | t"><app-icon name="close" [size]="20" /></button>
            </div>

            <!-- BARRE DE FILTRES -->
            <div class="filter-bar">
              <div class="search-pill-box">
                <app-icon class="search-icon" name="search" [size]="16" />
                <input 
                  #searchInput
                  type="text" 
                  [placeholder]="'Rechercher un {cat}...' | t: { cat: (currentCategoryLabel() | t).toLowerCase() }" 
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
                  <span>{{ currentSortLabel() | t }}</span>
                  <app-icon class="chevron-icon" [class.open]="isSortDropdownOpen()" name="chevronDown" [size]="14" [stroke]="2" />
                </button>

                @if (isSortDropdownOpen()) {
                  <div class="custom-dropdown-menu" (click)="$event.stopPropagation()">
                    <div 
                      class="dropdown-option" 
                      [class.selected]="sortOrder() === 'price-asc'"
                      (click)="setSort('price-asc')"
                    >
                      {{ 'Prix : Croissant' | t }}
                    </div>
                    <div 
                      class="dropdown-option" 
                      [class.selected]="sortOrder() === 'price-desc'"
                      (click)="setSort('price-desc')"
                    >
                      {{ 'Prix : Décroissant' | t }}
                    </div>
                    <div 
                      class="dropdown-option" 
                      [class.selected]="sortOrder() === 'name'"
                      (click)="setSort('name')"
                    >
                      {{ 'Nom (A-Z)' | t }}
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="modal-body" (click)="isSortDropdownOpen.set(false)">
              @if (loading()) {
                <div class="empty-results">
                  <div class="spinner"></div>
                  <p>{{ 'Chargement des {cat}s...' | t: { cat: (currentCategoryLabel() | t).toLowerCase() } }}</p>
                </div>
              } @else if (filteredCatalog().length === 0) {
                <div class="empty-results">
                  <p>{{ 'Aucun composant compatible en stock pour cette sélection.' | t }}</p>
                </div>
              } @else {
                <div class="picker-catalog-grid">
                  @for (item of filteredCatalog(); track item.id) {
                    @let isCurrent = selectedComponents()[activePickerCategory()!]?.id === item.id;
                    <div class="picker-card" [class.selected]="isCurrent" (click)="selectComponent(item)">
                      <div class="picker-img-wrapper">
                        @if (item.image) {
                          <img [src]="item.image.url" [alt]="(item.image.altText || item.name) | productName" (error)="handleImgError($event)" />
                        } @else {
                          <div class="no-img-box">{{ 'Sans image' | t }}</div>
                        }
                      </div>

                      <div class="picker-details">
                        <div class="category-brand-sub">
                          {{ item.brand }} · {{ item.highlights.join(' · ') }}
                        </div>
                        <h4 class="product-title" [title]="item.name | productName">{{ item.name | productName }}</h4>
                        
                        <div class="card-footer-row">
                          <span class="picker-price">{{ item.price }} TND</span>
                          <button 
                            class="btn-select-item" 
                            [class.selected]="isCurrent"
                            (click)="$event.stopPropagation(); selectComponent(item)"
                          >
                            {{ (isCurrent ? 'Choisi' : 'Sélectionner') | t }}
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
    .config-header h1 { font-size: var(--fs-4xl); font-weight: 800; margin: 0 0 0.4rem; }
    .subtitle { color: var(--muted, #94a3b8); font-size: var(--fs-ui); margin: 0; }
    .btn-reset { background: transparent; border: 1px solid var(--border, rgba(255, 255, 255, 0.15)); color: var(--muted, #94a3b8); padding: 0.6rem 1.1rem; border-radius: var(--r-md); cursor: pointer; font-size: var(--fs-md); transition: all 0.2s ease; }
    .btn-reset:hover:not(:disabled) { border-color: var(--red); color: var(--red); }
    .btn-reset:disabled { opacity: 0.4; cursor: not-allowed; }
    .configurator-grid { display: grid; grid-template-columns: 1fr 360px; gap: 2rem; }
    @media (max-width: 1024px) { .configurator-grid { grid-template-columns: 1fr; } }
    .selection-column { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    .chips-title { margin: 0.4rem 0 -0.2rem; font-family: var(--font-body); font-size: var(--fs-xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .slot-chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.6rem; }
    .slot-chip {
      display: flex; align-items: stretch; border-radius: var(--r-md); overflow: hidden;
      border: 1px dashed var(--border, #1e293b); background: var(--surface-2, #131927); transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .slot-chip.filled { border-style: solid; }
    .slot-chip.active, .slot-chip:hover { border-color: var(--accent, var(--accent)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, var(--accent)) 18%, transparent); }
    .chip-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; padding: 0.6rem 0.8rem; background: none; border: 0; text-align: left; cursor: pointer; color: inherit; font: inherit; }
    .chip-label { font-size: var(--fs-2xs); font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent, var(--accent)); }
    .chip-value { font-size: var(--fs-sm); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .slot-chip:not(.filled) .chip-value { color: var(--muted, #94a3b8); font-weight: 500; }
    .chip-remove { border: 0; background: none; color: var(--muted, #94a3b8); padding: 0 0.75rem; cursor: pointer; font-size: var(--fs-sm); }
    .chip-remove:hover { color: var(--red); }
    .summary-card { background: var(--surface-2, #131927); border: 1px solid var(--border, #1e293b); border-radius: var(--r-lg); padding: 1.5rem; position: sticky; top: 2rem; }
    .summary-card h2 { font-size: var(--fs-xl); margin: 0 0 1.2rem; }
    .summary-items { display: flex; flex-direction: column; gap: 0.6rem; }
    .summary-row { display: flex; justify-content: space-between; font-size: var(--fs-md); cursor: pointer; border-radius: var(--r-sm); padding: 0.15rem 0.35rem; margin: 0 -0.35rem; transition: background 0.15s ease; }
    .summary-row.active { background: color-mix(in srgb, var(--accent, var(--accent)) 14%, transparent); }
    .summary-row .label { color: var(--muted, #94a3b8); }
    .summary-row .value { font-weight: 600; }
    .summary-row .value.empty { color: var(--muted, #64748b); font-weight: 400; }
    .divider { height: 1px; background: var(--border, #1e293b); margin: 1.2rem 0; }
    .total-row { display: flex; justify-content: space-between; align-items: center; font-size: var(--fs-lg); font-weight: 700; margin-bottom: 1.5rem; }
    .total-price { font-size: var(--fs-2xl); color: var(--accent, var(--accent)); }
    .wattage-section { margin-bottom: 1.5rem; }
    .wattage-header { display: flex; justify-content: space-between; font-size: var(--fs-sm); color: var(--muted, #94a3b8); margin-bottom: 0.4rem; }
    .watt-val { font-weight: 600; color: var(--text, #fff); }
    .wattage-bar-bg { height: 6px; background: var(--surface, #0d1117); border-radius: 3px; overflow: hidden; }
    .wattage-bar-fill { height: 100%; background: var(--green); transition: width 0.3s ease; }
    .wattage-bar-fill.over-limit { background: var(--red); }
    .compatibility-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.2rem; }
    .compat-item { display: flex; align-items: center; gap: 0.5rem; font-size: var(--fs-sm); color: var(--red); }
    .compat-item.ok { color: var(--green); }
    .compat-item.pending { color: var(--muted, #94a3b8); }
    .compat-item.warn { color: var(--accent); }
    .save-form { display: flex; gap: 0.5rem; margin-top: 0.6rem; }
    .save-input { flex: 1; min-width: 0; background: var(--surface, #0d1117); border: 1px solid var(--border, #1e293b); color: var(--text, #fff); border-radius: var(--r-md); padding: 0.55rem 0.8rem; font: inherit; font-size: var(--fs-md); }
    .action-msg { margin: 0.8rem 0 0; font-size: var(--fs-sm); color: var(--green); text-align: center; }
    .action-msg.error { color: var(--red); }
    .compat-badge { padding: 0.7rem; border-radius: var(--r-md); text-align: center; font-size: var(--fs-md); font-weight: 600; background: color-mix(in srgb, var(--red) 15%, transparent); color: var(--red); border: 1px solid color-mix(in srgb, var(--red) 30%, transparent); margin-bottom: 1.2rem; }
    .compat-badge.valid { background: color-mix(in srgb, var(--green) 15%, transparent); color: var(--green); border-color: color-mix(in srgb, var(--green) 30%, transparent); }
    .btn-primary { background: var(--accent, var(--accent)); color: var(--on-accent); font-weight: 700; border: none; border-radius: var(--r-md); padding: 0.9rem; font-size: var(--fs-ui); cursor: pointer; width: 100%; margin-bottom: 0.6rem; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: transparent; border: 1px solid var(--border, #1e293b); color: var(--text, #fff); font-weight: 600; border-radius: var(--r-md); padding: 0.8rem; font-size: var(--fs-md); cursor: pointer; width: 100%; }

    /* MODALE DE SÉLECTION */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(6px); display: flex; justify-content: flex-end; z-index: 1000; animation: fadeIn 0.2s ease; }
    .modal-panel { width: 100%; max-width: 720px; height: 100%; background: var(--surface-2, #0b1120); border-left: 1px solid var(--border, rgba(255, 255, 255, 0.1)); display: flex; flex-direction: column; animation: slideLeft 0.25s ease; border-top-left-radius: 24px; border-bottom-left-radius: 24px; }
    .modal-header { padding: 1.5rem 1.8rem; border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08)); display: flex; justify-content: space-between; align-items: flex-start; }
    .modal-header h2 { margin: 0 0 0.3rem; font-size: var(--fs-xl); color: var(--text, #ffffff); }
    .modal-sub { margin: 0; font-size: var(--fs-md); color: var(--muted, #94a3b8); }
    .close-btn { background: none; border: none; color: var(--muted, #94a3b8); font-size: var(--fs-2xl); cursor: pointer; }
    
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
      border-color: var(--accent);
      box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 20%, transparent);
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
      color: var(--accent);
      transform: scale(1.05);
    }

    .filter-input-pill { 
      width: 100%; 
      height: 100%;
      background: transparent; 
      border: none; 
      color: var(--text, #ffffff); 
      padding: 0 1rem 0 2.5rem; 
      font-size: var(--fs-md); 
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
      font-size: var(--fs-md); 
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
      border-radius: var(--r-lg);
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
      border-radius: var(--r-md);
      font-size: var(--fs-md);
      color: var(--text, #ffffff);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .dropdown-option:hover {
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent);
    }

    .dropdown-option.selected {
      background: var(--accent);
      color: var(--on-accent);
      font-weight: 600;
    }

    .modal-body { flex: 1; overflow-y: auto; padding: 1.8rem; }
    .picker-catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1.2rem; }
    
    .picker-card { 
      background: var(--surface, #151d30); 
      border: 2px solid var(--border, rgba(255, 255, 255, 0.08)); 
      border-radius: var(--r-xl); 
      padding: 0.6rem; 
      display: flex; 
      flex-direction: column; 
      gap: 0.8rem; 
      transition: all 0.2s ease;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .picker-card:hover { border-color: var(--accent); transform: translateY(-2px); }
    .picker-card.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }

    .picker-img-wrapper { 
      width: 100%;
      height: 160px; 
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border-radius: var(--r-lg);
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
    .no-img-box { color: var(--muted, #94a3b8); font-size: var(--fs-sm); }

    .picker-details {
      display: flex;
      flex-direction: column;
      padding: 0.2rem 0.4rem 0.4rem;
      gap: 0.4rem;
      flex: 1;
    }
    .category-brand-sub {
      font-size: var(--fs-sm);
      color: var(--muted, #94a3b8);
      font-weight: 500;
    }
    .product-title { 
      margin: 0; 
      font-size: var(--fs-md); 
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
      color: var(--accent, var(--accent)); 
      font-size: var(--fs-base); 
    }
    
    .btn-select-item {
      background: var(--accent);
      color: var(--on-accent);
      border: none;
      font-weight: 700;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: var(--fs-sm);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-select-item:hover { background: var(--accent-hover); transform: scale(1.03); }
    .btn-select-item.selected {
      background: var(--green);
      color: var(--on-accent);
    }

    .empty-results { text-align: center; color: var(--muted, #94a3b8); padding: 4rem 0; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
    .spinner { width: 32px; height: 32px; border: 3px solid color-mix(in srgb, var(--accent) 20%, transparent); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
  `
})
export class ConfiguratorPage {
  // Libellés en français, traduits à l'affichage (et dans la vue 3D)
  // i18n
  readonly categories: { id: Slot; label: string; group: 'pc' | 'desk' }[] = [
    { id: 'cpu', label: 'Processeur', group: 'pc' },
    { id: 'cooler', label: 'Refroidissement CPU', group: 'pc' },
    { id: 'motherboard', label: 'Carte mère', group: 'pc' },
    { id: 'ram', label: 'Mémoire RAM', group: 'pc' },
    { id: 'gpu', label: 'Carte graphique', group: 'pc' },
    { id: 'storage', label: 'Stockage (SSD / HDD)', group: 'pc' },
    { id: 'psu', label: 'Alimentation', group: 'pc' },
    { id: 'case', label: 'Boîtier', group: 'pc' },
    { id: 'monitor', label: 'Écran', group: 'desk' },
    { id: 'keyboard', label: 'Clavier', group: 'desk' },
    { id: 'mouse', label: 'Souris', group: 'desk' },
    { id: 'headset', label: 'Casque', group: 'desk' },
  ];
  readonly chipGroups = [
    { title: 'Unité centrale', slots: this.categories.filter((c) => c.group === 'pc') },
    { title: 'Poste de travail (facultatif)', slots: this.categories.filter((c) => c.group === 'desk') },
  ];
  // /i18n

  readonly slotLabels = Object.fromEntries(this.categories.map((c) => [c.id, c.label])) as Record<Slot, string>;
  /** Emplacement survolé, dans la vue 3D comme dans les listes */
  readonly highlightedSlot = signal<Slot | null>(null);

  private api = inject(ConfiguratorApi);
  private auth = inject(AuthService);
  private cartState = inject(CartStateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private i18n = inject(I18nService);

  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly rawProducts = signal<ConfiguratorPart[]>([]);
  readonly hiddenCount = signal(0);

  readonly activePickerCategory = signal<Slot | null>(null);
  readonly searchQuery = signal('');
  readonly sortOrder = signal<'price-asc' | 'price-desc' | 'name'>('price-asc');
  readonly isSortDropdownOpen = signal(false);

  readonly selectedComponents = signal<Record<Slot, ConfiguratorPart | null>>({ ...EMPTY_SELECTION });
  readonly selectedIds = computed(() =>
    Object.values(this.selectedComponents())
      .filter((p): p is ConfiguratorPart => !!p)
      .map((p) => p.id),
  );

  // Configuration enregistrée en cours d'édition
  readonly configId = signal<number | null>(null);
  readonly configName = signal('');
  readonly saveOpen = signal(false);
  readonly actionMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bilan de compatibilité recalculé par le serveur à chaque changement de sélection
  readonly buildCheck = signal<BuildCheck | null>(null);

  constructor() {
    toObservable(this.selectedIds)
      .pipe(
        distinctUntilChanged((a, b) => a.join() === b.join()),
        switchMap((ids) => (ids.length ? this.api.check(ids).pipe(catchError(() => of(null))) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe((check) => this.buildCheck.set(check));

    // Changement de langue : bilan de compatibilité et points forts des pièces redemandés à l'API
    let firstLang = true;
    effect(() => {
      this.i18n.lang();
      if (firstLang) {
        firstLang = false;
        return;
      }
      untracked(() => {
        const ids = this.selectedIds();
        if (!ids.length) return;
        this.api
          .check(ids)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (check) => {
              this.buildCheck.set(check);
              this.applyParts(check.parts);
            },
            error: () => undefined,
          });
      });
    });

    const configId = Number(this.route.snapshot.queryParamMap.get('configId'));
    if (configId > 0 && this.auth.isLoggedIn()) this.loadConfiguration(configId);
    else this.restoreLocal();
  }

  // --- Sélecteur de composants ---

  openPicker(slot: Slot) {
    this.activePickerCategory.set(slot);
    this.searchQuery.set('');
    this.isSortDropdownOpen.set(false);
    this.rawProducts.set([]);
    this.hiddenCount.set(0);
    this.loading.set(true);

    // Seuls les composants compatibles avec le reste de la sélection sont proposés
    const others = this.selectedIds().filter((id) => id !== this.selectedComponents()[slot]?.id);
    this.api
      .parts(slot, others)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (this.activePickerCategory() !== slot) return;
          this.rawProducts.set(res.items);
          this.hiddenCount.set(res.hidden);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  closePicker() {
    this.activePickerCategory.set(null);
    this.isSortDropdownOpen.set(false);
  }

  currentCategoryLabel() {
    return this.categories.find((c) => c.id === this.activePickerCategory())?.label ?? '';
  }

  currentSortLabel = computed(() => {
    // i18n
    switch (this.sortOrder()) {
      case 'price-desc':
        return 'Prix : Décroissant';
      case 'name':
        return 'Nom (A-Z)';
      default:
        return 'Prix : Croissant';
    }
    // /i18n
  });

  setSort(order: 'price-asc' | 'price-desc' | 'name') {
    this.sortOrder.set(order);
    this.isSortDropdownOpen.set(false);
  }

  filteredCatalog = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = q
      ? this.rawProducts().filter((item) => item.name.toLowerCase().includes(q) || item.brand.toLowerCase().includes(q))
      : [...this.rawProducts()];

    const sort = this.sortOrder();
    return list.sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      return a.name.localeCompare(b.name);
    });
  });

  selectComponent(item: ConfiguratorPart) {
    this.selectedComponents.update((prev) => ({ ...prev, [item.slot]: item }));
    this.afterChange();
    this.closePicker();
  }

  removeComponent(slot: Slot) {
    this.selectedComponents.update((prev) => ({ ...prev, [slot]: null }));
    this.afterChange();
  }

  resetAll() {
    this.selectedComponents.set({ ...EMPTY_SELECTION });
    this.configId.set(null);
    this.configName.set('');
    this.afterChange();
  }

  handleImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  // --- Résumé ---

  selectedCount = computed(() => this.selectedIds().length);
  totalPrice = computed(() => {
    const total = Object.values(this.selectedComponents()).reduce((sum, item) => sum + (item?.price ?? 0), 0);
    return Math.round(total * 1000) / 1000;
  });
  checks = computed(() => this.buildCheck()?.checks ?? []);
  totalWatts = computed(() => this.buildCheck()?.estimatedWatts ?? 0);
  psuCapacity = computed(() => this.selectedComponents().psu?.psu?.wattage ?? 0);
  wattagePercentage = computed(() => {
    if (!this.psuCapacity()) return 0;
    return Math.min(100, Math.round((this.totalWatts() / this.psuCapacity()) * 100));
  });
  isGlobalValid = computed(() => this.buildCheck()?.valid ?? true);

  // --- Actions ---

  addToCart() {
    const parts = Object.values(this.selectedComponents()).filter((p): p is ConfiguratorPart => !!p);
    if (!parts.length || !this.isGlobalValid()) return;

    this.busy.set(true);
    this.actionMessage.set(null);
    concat(
      ...parts.map((p) =>
        this.cartState.addItem({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          stockQuantity: p.stockQuantity,
          image: p.image,
        }),
      ),
    )
      .pipe(toArray())
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.router.navigateByUrl('/panier');
        },
        error: (e) => {
          this.busy.set(false);
          this.actionMessage.set({ type: 'error', text: apiErrors(e).join(' ') });
        },
      });
  }

  openSave() {
    this.actionMessage.set(null);
    if (!this.auth.isLoggedIn()) {
      // La sélection est conservée localement : elle sera retrouvée après la connexion
      this.router.navigate(['/connexion'], { queryParams: { redirect: '/configurateur' } });
      return;
    }
    if (!this.configName()) this.configName.set(translate('Ma configuration'));
    this.saveOpen.set(!this.saveOpen());
  }

  save() {
    const name = this.configName().trim();
    if (!name) return;
    const ids = this.selectedIds();
    const id = this.configId();

    this.busy.set(true);
    (id ? this.api.update(id, name, ids) : this.api.create(name, ids)).subscribe({
      next: (saved) => {
        this.busy.set(false);
        this.saveOpen.set(false);
        this.configId.set(saved.id);
        this.configName.set(saved.name);
        this.persistLocal();
        this.actionMessage.set({ type: 'success', text: translate('« {name} » enregistrée dans votre compte.', { name: saved.name }) });
      },
      error: (e) => {
        this.busy.set(false);
        this.actionMessage.set({ type: 'error', text: apiErrors(e).join(' ') });
      },
    });
  }

  // --- Chargement / persistance ---

  private loadConfiguration(id: number) {
    this.api.get(id).subscribe({
      next: (config) => {
        this.applyParts(config.parts);
        this.configId.set(config.id);
        this.configName.set(config.name);
        this.persistLocal();
        if (config.unavailable) {
          this.actionMessage.set({
            type: 'error',
            text: translate('{n} composant(s) de cette configuration ne sont plus en vente et ont été retirés.', { n: config.unavailable }),
          });
        }
      },
      error: () => {
        this.actionMessage.set({ type: 'error', text: translate('Configuration introuvable.') });
        this.restoreLocal();
      },
    });
  }

  private restoreLocal() {
    let stored: StoredBuild | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredBuild | null;
    } catch {
      stored = null;
    }
    if (!stored?.ids?.length) return;

    this.configId.set(stored.configId ?? null);
    this.configName.set(stored.name ?? '');
    this.api
      .check(stored.ids)
      .pipe(map((check) => check.parts))
      .subscribe({
        next: (parts) => this.applyParts(parts),
        // Composant retiré de la vente entre-temps (404) : on repart d'une configuration vide.
        // Serveur injoignable ou en redémarrage : la sélection enregistrée est conservée.
        error: (e: HttpErrorResponse) => {
          if (e.status === 404) this.resetAll();
        },
      });
  }

  private applyParts(parts: ConfiguratorPart[]) {
    const selection = { ...EMPTY_SELECTION };
    for (const part of parts) selection[part.slot] = part;
    this.selectedComponents.set(selection);
  }

  private afterChange() {
    this.actionMessage.set(null);
    this.saveOpen.set(false);
    this.persistLocal();
  }

  private persistLocal() {
    try {
      const stored: StoredBuild = { ids: this.selectedIds(), configId: this.configId(), name: this.configName() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // stockage indisponible : la sélection ne survivra pas au rechargement
    }
  }
}
