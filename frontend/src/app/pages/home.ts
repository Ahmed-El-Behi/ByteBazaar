import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CatalogApi } from '../core/catalog-api';
import { CategoryNode, Paginated, ProductListItem } from '../core/models';
import { ProductCard } from '../components/product-card';
import { Icon, type IconName } from '../components/icon';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard, Icon],
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
          <app-icon name="arrowUpRight" [size]="15" [stroke]="2" />
        </a>
      </div>

      <div class="categories-grid">
        @for (c of tiles(); track c.id) {
          <a class="category-card" routerLink="/produits" [queryParams]="{ category: c.slug }">
            <div class="card-inner">
              <div class="cat-icon"><app-icon [name]="categoryIcon(c.slug)" [size]="24" /></div>
              <h3 class="cat-title">{{ c.nameFr }}</h3>
            </div>
            <app-icon class="cat-arrow" name="arrowUpRight" [size]="16" [stroke]="2" />
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
    .eyebrow { display: inline-block; padding: 0.3rem 0.9rem; border-radius: 999px; background: var(--hero-chip); font-weight: 600; font-size: var(--fs-md); margin: 0 0 1rem; }
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
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--muted, #8c94a4);
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }

    .tag-label .dot {
      width: 6px;
      height: 6px;
      background-color: var(--accent, var(--accent));
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
      color: var(--accent, var(--accent));
      font-weight: 600;
      font-size: var(--fs-md);
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
      border-radius: var(--r-md);
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
      border-color: var(--accent, var(--accent));
      transform: translateY(-2px);
      box-shadow: var(--shadow-lift, 0 8px 20px rgba(0, 0, 0, 0.15));
    }

    .cat-icon {
      color: var(--accent, var(--accent));
      margin-bottom: 0.6rem;
      display: flex;
      align-items: center;
    }

    .cat-title {
      font-size: var(--fs-ui);
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
      color: var(--accent, var(--accent));
    }
  `,
})
export class HomePage {
  private api = inject(CatalogApi);

  private categories = toSignal(
    this.api.categories().pipe(catchError(() => of([] as CategoryNode[]))),
    { initialValue: [] as CategoryNode[] },
  );


  readonly tiles = computed(() =>
    this.categories()
      .flatMap((root) => (root.children.length ? root.children : [root]))
      .filter((c) => c._count.products > 0)
      .sort((a, b) => b._count.products - a._count.products),
  );

  readonly latest = toSignal<Paginated<ProductListItem> | null>(
    this.api.products({ limit: '4', sort: 'newest' }).pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  /** Icône Lucide de chaque catégorie (d'après son slug) */
  categoryIcon(slug: string): IconName {
    const s = slug.toLowerCase();
    if (/graphi|gpu/.test(s)) return 'gpu';
    if (/processeur|processor|cpu/.test(s)) return 'cpu';
    if (/cartes?-meres?|motherboard/.test(s)) return 'motherboard';
    if (/memoire|memory|ram/.test(s)) return 'memory';
    if (/stockage|storage|ssd|hdd/.test(s)) return 'storage';
    if (/refroidissement|cooling/.test(s)) return 'cooling';
    if (/alimentation|power/.test(s)) return 'power';
    if (/ecran|monitor/.test(s)) return 'monitor';
    if (/souris|mouse/.test(s)) return 'mouse';
    if (/clavier|keyboard/.test(s)) return 'keyboard';
    if (/casque|headset|headphone/.test(s)) return 'headset';
    if (/enceinte|speaker/.test(s)) return 'speaker';
    if (/webcam/.test(s)) return 'webcam';
    return 'box';
  }
}