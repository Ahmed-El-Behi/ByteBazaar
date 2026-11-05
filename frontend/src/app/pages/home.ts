import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CatalogApi } from '../core/catalog-api';
import { CategoryNode, Paginated, ProductListItem } from '../core/models';
import { ProductCard } from '../components/product-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard],
  template: `
    <section class="hero">
      <div class="container">
        <p class="eyebrow">Composants PC · Tunisie</p>
        <h1>Le bazar des <span>composants PC</span> en Tunisie</h1>
        <p class="lead">
          Un très large choix multi-marques, des prix clairs en TND et, bientôt, un configurateur
          qui garantit des assemblages compatibles.
        </p>
        <a class="btn primary" routerLink="/produits">Voir le catalogue</a>
      </div>
    </section>

    <!-- SECTION CATÉGORIES -->
    <section class="container section-padding">
      <div class="section-header">
        <div>
          <div class="tag-label"><span class="dot"></span> TROUVEZ VOTRE COMPOSANT</div>
          <h2 class="section-title">Chaque pièce. Tout son potentiel.</h2>
        </div>
        <a routerLink="/produits" class="link-arrow">
          Toutes les catégories
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 17L17 7M17 7H7M17 7V17"/>
          </svg>
        </a>
      </div>

      <div class="categories-grid">
        @for (c of tiles(); track c.id) {
          <a class="category-card" routerLink="/produits" [queryParams]="{ category: c.slug }">
            <div class="card-inner">
              <div class="cat-icon" [innerHTML]="getCategoryIcon(c.slug)"></div>
              <h3 class="cat-title">{{ c.nameFr }}</h3>
            </div>
            <svg class="cat-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 17L17 7M17 7H7M17 7V17"/>
            </svg>
          </a>
        }
      </div>
    </section>

    <section class="container section">
      <h2>Derniers ajouts</h2>
      @if (latest(); as l) {
        <div class="grid-products">
          @for (p of l.data; track p.id) {
            <app-product-card [product]="p" />
          }
        </div>
      } @else {
        <p class="muted">Chargement…</p>
      }
    </section>
  `,
  styles: `
    .hero { position: relative; overflow: hidden; width: min(1200px, 100% - 2rem); margin: 1.5rem auto 0; padding: 4.5rem 3rem; border-radius: 40px; color: var(--hero-ink); background: var(--hero-bg); }
    .hero::after { content: ''; position: absolute; right: -90px; top: -90px; width: 340px; height: 340px; border-radius: 50%; background: var(--hero-circle); }
    .hero .container { position: relative; z-index: 1; width: 100%; margin: 0; }
    .eyebrow { display: inline-block; padding: 0.3rem 0.9rem; border-radius: 999px; background: var(--hero-chip); font-weight: 600; font-size: 0.85rem; margin: 0 0 1rem; }
    h1 { font-size: clamp(2rem, 5vw, 3.2rem); max-width: 18ch; }
    h1 span { color: inherit; }
    .lead { color: var(--hero-lead); max-width: 56ch; margin-bottom: 1.8rem; }
    .hero .btn.primary { background: var(--hero-btn-bg); color: var(--hero-btn-ink); border-color: var(--hero-btn-bg); }

    .section-padding { padding-block: 3.5rem 2rem; }
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 2rem;
    }

    .tag-label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--muted, #8c94a4);
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }

    .tag-label .dot {
      width: 6px;
      height: 6px;
      background-color: var(--accent, #3b82f6);
      border-radius: 50%;
    }

    .section-title {
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0;
      color: var(--text, inherit);
    }

    .link-arrow {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--accent, #3b82f6);
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      transition: gap 0.2s ease, opacity 0.2s ease;
    }
    .link-arrow:hover { gap: 0.6rem; opacity: 0.9; }

    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .category-card {
      background: var(--surface-2, var(--surface, rgba(255, 255, 255, 0.03)));
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      border-radius: 16px;
      padding: 1.4rem;
      text-decoration: none;
      color: var(--text, inherit);
      position: relative;
      transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      align-items: center;
      min-height: 120px;
    }

    .card-inner {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .category-card:hover {
      border-color: var(--accent, #3b82f6);
      transform: translateY(-2px);
      box-shadow: var(--shadow-lift, 0 8px 20px rgba(0, 0, 0, 0.15));
    }

    .cat-icon {
      color: var(--accent, #3b82f6);
      margin-bottom: 0.6rem;
      display: flex;
      align-items: center;
    }

    .cat-title {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0;
      color: var(--text, inherit);
      line-height: 1.25;
    }

    .cat-arrow {
      position: absolute;
      top: 1.2rem;
      right: 1.2rem;
      opacity: 0.4;
      color: var(--muted, #8c94a4);
      transition: opacity 0.2s ease, color 0.2s ease;
    }

    .category-card:hover .cat-arrow {
      opacity: 1;
      color: var(--accent, #3b82f6);
    }
  `,
})
export class HomePage {
  private api = inject(CatalogApi);

  private categories = toSignal(
    this.api.categories().pipe(catchError(() => of([] as CategoryNode[]))),
    { initialValue: [] as CategoryNode[] },
  );

  private excludedSlugs = ['souris', 'clavier', 'ecran', 'ecrans', 'moniteur', 'moniteurs', 'peripheriques', 'peripherique', 'mouse', 'keyboard', 'screen', 'peripherals'];

  readonly tiles = computed(() =>
    this.categories()
      .flatMap((root) => (root.children.length ? root.children : [root]))
      .filter((c) => c._count.products > 0 && !this.excludedSlugs.some(slug => c.slug.toLowerCase().includes(slug)))
      .sort((a, b) => b._count.products - a._count.products),
  );

  readonly latest = toSignal<Paginated<ProductListItem> | null>(
    this.api.products({ limit: '4' }).pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  getCategoryIcon(slug: string): string {
    const s = slug.toLowerCase();
    if (s.includes('graphic') || s.includes('carte-graphique') || s.includes('gpu')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="7" cy="12" r="2"></circle><circle cx="17" cy="12" r="2"></circle></svg>`;
    } else if (s.includes('processor') || s.includes('processeur') || s.includes('cpu')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="15" x2="23" y2="15"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="15" x2="4" y2="15"></line></svg>`;
    } else if (s.includes('motherboard') || s.includes('carte-mere')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"></rect><line x1="6" y1="8" x2="18" y2="8"></line><line x1="6" y1="12" x2="18" y2="12"></line><line x1="6" y1="16" x2="12" y2="16"></line></svg>`;
    } else if (s.includes('memory') || s.includes('ram') || s.includes('memoire')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="1"></rect><line x1="6" y1="17" x2="6" y2="20"></line><line x1="10" y1="17" x2="10" y2="20"></line><line x1="14" y1="17" x2="14" y2="20"></line><line x1="18" y1="17" x2="18" y2="20"></line></svg>`;
    } else if (s.includes('storage') || s.includes('stockage') || s.includes('ssd') || s.includes('hdd')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12H2v-2a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2z"></path><path d="M22 20H2v-2a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2z"></path><circle cx="6" cy="9" r="1"></circle><circle cx="6" cy="17" r="1"></circle></svg>`;
    } else if (s.includes('cooling') || s.includes('refroidissement') || s.includes('power') || s.includes('aliment')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a4 4 0 0 0 4 4v12a4 4 0 0 0-4 4"></path><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"></path></svg>`;
    }
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18"></path><path d="M9 21V9"></path></svg>`;
  }
}