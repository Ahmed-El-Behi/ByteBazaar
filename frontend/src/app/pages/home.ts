import { Component, ElementRef, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CatalogApi } from '../core/catalog-api';
import { Brand, CategoryNode, Paginated, ProductListItem } from '../core/models';
import { TndPipe } from '../core/tnd.pipe';
import { ProductCard } from '../components/product-card';
import { Icon, type IconName } from '../components/icon';
import { CountUp, Reveal } from '../components/reveal';
import { LocalNamePipe, ProductNamePipe, TPipe } from '../core/i18n';

/** Marques connues mises en avant dans le bandeau défilant (seules celles présentes en base s'affichent) */
const FEATURED_BRANDS = [
  'AMD', 'Intel', 'NVIDIA', 'Asus', 'MSI', 'Gigabyte', 'Corsair', 'Kingston', 'Samsung', 'Western Digital',
  'Crucial', 'G.Skill', 'NZXT', 'Lian Li', 'be quiet!', 'Noctua', 'Thermaltake', 'Seasonic', 'Cooler Master',
  'Logitech', 'Razer', 'SteelSeries', 'HyperX', 'LG', 'AOC', 'BenQ', 'Zotac', 'Sapphire', 'ASRock', 'Fractal Design',
];

/** Les emplacements du configurateur, dans l'ordre du montage (libellés traduits dans le template) */
// i18n
const BUILD_STEPS: { icon: IconName; label: string }[] = [
  { icon: 'cpu', label: 'Processeur' },
  { icon: 'cooling', label: 'Refroidissement' },
  { icon: 'motherboard', label: 'Carte mère' },
  { icon: 'memory', label: 'Mémoire RAM' },
  { icon: 'gpu', label: 'Carte graphique' },
  { icon: 'storage', label: 'Stockage' },
  { icon: 'power', label: 'Alimentation' },
  { icon: 'box', label: 'Boîtier' },
];
// /i18n

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard, Icon, Reveal, CountUp, TndPipe, TPipe, LocalNamePipe, ProductNamePipe],
  template: `
    <!-- BANDEAU D'ACCUEIL -->
    <section class="hero" (pointermove)="onHeroPointer($event)" (pointerleave)="resetHeroPointer()">
      <div class="hero-grid-bg" aria-hidden="true"></div>
      <div class="hero-spot" aria-hidden="true"></div>

      <div class="hero-copy">
        <p class="eyebrow"><span class="pulse"></span> {{ 'Composants PC · Tunisie' | t }}</p>
        <h1>{{ 'Le bazar des' | t }} <span class="shine">{{ 'composants PC' | t }}</span> {{ 'en Tunisie' | t }}</h1>
        <p class="lead">
          {{ 'Un très large choix multi-marques, des prix clairs en TND et un configurateur 3D qui garantit des assemblages compatibles.' | t }}
        </p>
        <div class="hero-ctas">
          <a class="btn primary hero-main" routerLink="/produits">
            {{ 'Voir le catalogue' | t }} <app-icon name="arrowRight" [size]="17" [stroke]="2.2" />
          </a>
          <a class="btn ghost" routerLink="/configurateur">
            <app-icon name="wrench" [size]="17" /> {{ 'Composer mon PC' | t }}
          </a>
        </div>

        <dl class="stats">
          <div>
            <dt>{{ 'Produits' | t }}</dt>
            <dd [appCountUp]="stats().products"></dd>
          </div>
          <div>
            <dt>{{ 'Catégories' | t }}</dt>
            <dd [appCountUp]="stats().categories"></dd>
          </div>
          <div>
            <dt>{{ 'Marques' | t }}</dt>
            <dd [appCountUp]="stats().brands"></dd>
          </div>
        </dl>
      </div>

      <!-- Vitrine : les derniers produits ajoutés, en cartes flottantes -->
      <div class="hero-showcase" [attr.aria-label]="'Produits phares' | t">
        @if (showcase().length) {
          @for (p of showcase(); track p.id; let i = $index) {
            <a class="float-card" [attr.data-i]="i" [routerLink]="['/produits', p.slug]">
              <div class="float-inner">
                <div class="float-ph">
                  @if (p.image; as img) {
                    <img [src]="img.url" [alt]="(img.altText ?? p.name) | productName" />
                  } @else {
                    <span>{{ p.brand.name }}</span>
                  }
                </div>
                <div class="float-meta">
                  <small>{{ p.category | localName }}</small>
                  <strong>{{ p.name | productName }}</strong>
                  <span class="float-price">{{ p.price | tnd }}</span>
                </div>
              </div>
            </a>
          }
        } @else {
          @for (i of [0, 1, 2]; track i) {
            <div class="float-card skeleton" [attr.data-i]="i"><div class="float-inner"></div></div>
          }
        }
      </div>
    </section>

    <!-- BANDEAU DES MARQUES -->
    @if (brandStrip().length) {
      <section class="brands" [attr.aria-label]="'Marques disponibles' | t">
        <div class="marquee">
          <div class="track">
            @for (b of brandStrip(); track $index) {
              <a [routerLink]="['/produits']" [queryParams]="{ brand: b.slug }" [attr.aria-hidden]="$index >= brandStrip().length / 2 ? 'true' : null" [tabindex]="$index >= brandStrip().length / 2 ? -1 : 0">
                {{ b.name }}
              </a>
            }
          </div>
        </div>
      </section>
    }

    <!-- CATÉGORIES -->
    <section class="container section-padding">
      <div class="section-header" appReveal>
        <div>
          <div class="tag-label"><span class="dot"></span> {{ 'Trouvez votre composant' | t }}</div>
          <h2 class="section-title">{{ 'Chaque pièce. Tout son potentiel.' | t }}</h2>
        </div>
        <a routerLink="/produits" class="link-arrow">
          {{ 'Toutes les catégories' | t }}
          <app-icon name="arrowUpRight" [size]="15" [stroke]="2" />
        </a>
      </div>

      <div class="categories-grid">
        @for (c of tiles(); track c.id; let i = $index) {
          <a
            class="category-card"
            appReveal
            [revealDelay]="(i % 8) * 45"
            routerLink="/produits"
            [queryParams]="{ category: c.slug }"
            (pointermove)="onSpot($event)"
          >
            <div class="card-inner">
              <div class="cat-icon"><app-icon [name]="categoryIcon(c.slug)" [size]="22" /></div>
              <h3 class="cat-title">{{ c | localName }}</h3>
              <span class="cat-count">{{ '{n} produits' | t: { n: c._count.products } }}</span>
            </div>
            <app-icon class="cat-arrow" name="arrowUpRight" [size]="16" [stroke]="2" />
          </a>
        } @empty {
          @for (i of [0, 1, 2, 3, 4, 5, 6, 7]; track i) {
            <div class="category-card skeleton"></div>
          }
        }
      </div>
    </section>

    <!-- CONFIGURATEUR -->
    <section class="container">
      <div class="config-band" appReveal>
        <div class="config-copy">
          <div class="tag-label light"><span class="dot"></span> {{ 'Configurateur PC' | t }}</div>
          <h2>{{ 'Montez votre PC pièce par pièce,' | t }} <span>{{ 'sans erreur' | t }}</span>.</h2>
          <p>
            {{ "Choisissez une carte mère : seuls les processeurs du même socket et la mémoire du même type vous sont proposés. Survolez chaque pièce dans la vue 3D et changez-la d'un clic." | t }}
          </p>
          <ul class="config-points">
            <li><app-icon name="shield" [size]="17" /> {{ "Compatibilité vérifiée à chaque choix" | t }}</li>
            <li><app-icon name="gauge" [size]="17" /> {{ "Consommation et puissance d'alimentation estimées" | t }}</li>
            <li><app-icon name="package" [size]="17" /> {{ "Configurations enregistrées dans votre compte" | t }}</li>
          </ul>
          <a class="btn primary" routerLink="/configurateur">
            {{ 'Lancer le configurateur' | t }} <app-icon name="arrowRight" [size]="17" [stroke]="2.2" />
          </a>
        </div>

        <ol class="build-steps" [attr.aria-label]="'Étapes du montage' | t">
          @for (s of steps; track s.label; let i = $index) {
            <li [style.--i]="i">
              <span class="step-icon"><app-icon [name]="s.icon" [size]="20" /></span>
              <span class="step-label">{{ s.label | t }}</span>
              <app-icon class="step-check" name="check" [size]="15" [stroke]="2.6" />
            </li>
          }
        </ol>
      </div>
    </section>

    <!-- DERNIERS AJOUTS -->
    <section class="container section-padding">
      <div class="section-header" appReveal>
        <div>
          <div class="tag-label"><span class="dot"></span> {{ 'Nouveautés' | t }}</div>
          <h2 class="section-title">{{ 'Derniers ajouts' | t }}</h2>
        </div>
        <a routerLink="/produits" [queryParams]="{ sort: 'newest' }" class="link-arrow">
          {{ 'Voir les nouveautés' | t }}
          <app-icon name="arrowUpRight" [size]="15" [stroke]="2" />
        </a>
      </div>
      @if (latest(); as l) {
        <div class="grid-products">
          @for (p of l.data.slice(0, 4); track p.id) {
            <app-product-card [product]="p" />
          }
        </div>
      } @else {
        <div class="grid-products">
          @for (i of [0, 1, 2, 3]; track i) {
            <div class="card product-skeleton"><div class="skeleton sk-img"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line short"></div></div>
          }
        </div>
      }
    </section>

    <!-- ATOUTS -->
    <section class="container perks-wrap">
      <div class="perks">
        @for (p of perks; track p.title; let i = $index) {
          <div class="perk" appReveal [revealDelay]="i * 70">
            <span class="perk-icon"><app-icon [name]="p.icon" [size]="20" /></span>
            <div>
              <strong>{{ p.title | t }}</strong>
              <p>{{ p.text | t }}</p>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    /* ------------------------------------------------------------ Bandeau d'accueil */
    .hero {
      --px: 0; --py: 0; --sx: 70%; --sy: 30%;
      position: relative; overflow: hidden; isolation: isolate;
      display: grid; grid-template-columns: 1.08fr 0.92fr; align-items: center; gap: 2rem;
      width: min(1200px, 100% - 2rem); margin: 1.5rem auto 0; padding: 4rem 3rem;
      border-radius: 40px; color: var(--hero-ink); background: var(--hero-bg);
      box-shadow: 0 30px 60px -36px color-mix(in srgb, var(--accent) 70%, transparent);
    }
    .hero::after {
      content: ''; position: absolute; right: -90px; top: -90px; width: 340px; height: 340px; border-radius: 50%;
      background: var(--hero-circle); z-index: -1;
      transform: translate(calc(var(--px) * -14px), calc(var(--py) * -14px));
      transition: transform 0.4s ease-out;
    }
    .hero-grid-bg {
      position: absolute; inset: 0; z-index: -2; opacity: 0.16;
      background-image: linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px);
      background-size: 44px 44px;
      mask-image: radial-gradient(ellipse at 70% 40%, #000 0%, transparent 70%);
    }
    .hero-spot {
      position: absolute; inset: 0; z-index: -1; pointer-events: none;
      background: radial-gradient(420px circle at var(--sx) var(--sy), rgba(255, 255, 255, 0.14), transparent 60%);
    }
    .hero-copy { position: relative; }
    .eyebrow {
      display: inline-flex; align-items: center; gap: 0.55rem; padding: 0.35rem 0.95rem; border-radius: 999px;
      background: var(--hero-chip); font-weight: 600; font-size: var(--fs-md); margin: 0 0 1.1rem;
      backdrop-filter: blur(6px); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
    }
    .pulse { position: relative; width: 8px; height: 8px; border-radius: 50%; background: var(--sun); }
    .pulse::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--sun); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; }
    @keyframes ping { 75%, 100% { transform: scale(2.6); opacity: 0; } }

    h1 { font-size: clamp(2.1rem, 5vw, 3.5rem); max-width: 16ch; color: inherit; line-height: 1.05; letter-spacing: -0.035em; margin-bottom: 1rem; }
    .shine {
      background: linear-gradient(100deg, var(--hero-ink) 0%, var(--hero-ink) 35%, var(--sun) 50%, var(--hero-ink) 65%, var(--hero-ink) 100%);
      background-size: 250% 100%; background-position: 100% 0;
      -webkit-background-clip: text; background-clip: text; color: transparent;
      animation: shine 5s ease-in-out 0.6s infinite;
    }
    @keyframes shine { 0% { background-position: 100% 0; } 45%, 100% { background-position: -50% 0; } }
    .lead { color: var(--hero-lead); max-width: 52ch; margin: 0 0 1.8rem; font-size: var(--fs-lg); line-height: 1.6; }

    .hero-ctas { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .hero .btn.primary { background: var(--hero-btn-bg); color: var(--hero-btn-ink); border-color: var(--hero-btn-bg); padding: 0.85rem 1.5rem; }
    .hero .btn.primary:hover { box-shadow: 0 16px 30px -14px rgba(0, 0, 0, 0.5); }
    .hero .btn.primary app-icon { transition: transform 0.2s; }
    .hero .btn.primary:hover app-icon { transform: translateX(3px); }
    .btn.ghost {
      background: rgba(255, 255, 255, 0.08); color: var(--hero-ink); border-color: rgba(255, 255, 255, 0.28);
      padding: 0.85rem 1.4rem; box-shadow: none; backdrop-filter: blur(6px);
    }
    .btn.ghost:hover:not(:disabled) { background: rgba(255, 255, 255, 0.16); border-color: rgba(255, 255, 255, 0.5); }

    .stats { display: flex; gap: 2.2rem; margin: 2.4rem 0 0; padding-top: 1.4rem; border-top: 1px solid rgba(255, 255, 255, 0.16); }
    .stats div { display: flex; flex-direction: column-reverse; }
    .stats dt { font-size: var(--fs-sm); color: var(--hero-lead); font-weight: 600; }
    .stats dd { margin: 0; font-family: var(--font-display); font-size: var(--fs-3xl); font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.1; }

    /* Vitrine flottante */
    .hero-showcase { position: relative; height: 400px; perspective: 1200px; }
    .float-card {
      position: absolute; width: 215px; color: var(--text); text-decoration: none;
      transform: translate3d(calc(var(--px) * var(--depth) * 1px), calc(var(--py) * var(--depth) * 1px), 0) rotate(var(--rot));
      transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    .float-card[data-i='0'] { --depth: 18; --rot: -6deg; left: 2%; top: 14%; z-index: 1; }
    .float-card[data-i='1'] { --depth: 30; --rot: 3deg; left: 32%; top: 0%; z-index: 3; }
    .float-card[data-i='2'] { --depth: 12; --rot: 7deg; left: 52%; top: 40%; z-index: 2; }
    .float-inner {
      padding: 0.55rem; border-radius: var(--r-xl); background: var(--surface);
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      box-shadow: 0 30px 50px -24px rgba(0, 0, 0, 0.55), 0 8px 16px -8px rgba(0, 0, 0, 0.25);
      animation: float 6s ease-in-out infinite;
      transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.3s;
    }
    [data-i='1'] .float-inner { animation-delay: -2s; }
    [data-i='2'] .float-inner { animation-delay: -4s; }
    @keyframes float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -12px; } }
    .float-card:hover { z-index: 5; }
    .float-card:hover .float-inner { transform: scale(1.05) rotate(calc(var(--rot) * -1)); box-shadow: 0 40px 60px -24px rgba(0, 0, 0, 0.6); }
    .float-ph {
      aspect-ratio: 4 / 3; display: grid; place-items: center; overflow: hidden; border-radius: var(--r-lg);
      background: radial-gradient(circle at 50% 40%, #fff, var(--ph-bg, #f6f8fc) 75%); color: #5f6b88; font-weight: 700;
    }
    .float-ph img { width: 100%; height: 100%; object-fit: contain; padding: 0.8rem; mix-blend-mode: multiply; }
    .float-meta { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.65rem 0.4rem 0.3rem; }
    .float-meta small { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
    .float-meta strong { font-size: var(--fs-sm); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .float-price { font-family: var(--font-display); font-weight: 800; color: var(--accent); font-size: var(--fs-base); margin-top: 0.15rem; }
    .float-card.skeleton .float-inner { height: 250px; background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.15); box-shadow: none; }

    /* ------------------------------------------------------------ Marques */
    .brands { width: min(1200px, 100% - 2rem); margin: 1.6rem auto 0; }
    .marquee {
      overflow: hidden; padding: 0.9rem 0; border-block: 1px solid var(--border);
      mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
    }
    .track { display: flex; gap: 3rem; width: max-content; animation: marquee 48s linear infinite; }
    .marquee:hover .track { animation-play-state: paused; }
    .track a {
      font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 700; letter-spacing: -0.02em;
      color: var(--muted); opacity: 0.7; white-space: nowrap; transition: color 0.2s, opacity 0.2s;
    }
    .track a:hover { color: var(--accent); opacity: 1; }
    @keyframes marquee { to { transform: translateX(calc(-50% - 1.5rem)); } }

    /* ------------------------------------------------------------ Sections */
    .section-padding { padding-block: 3.5rem 2rem; }
    .section-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; margin-bottom: 1.8rem; flex-wrap: wrap; }
    .tag-label {
      display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;
      font-size: var(--fs-xs); font-weight: 700; letter-spacing: 0.12em; color: var(--muted); text-transform: uppercase;
    }
    .tag-label .dot { width: 6px; height: 6px; background-color: var(--accent); border-radius: 50%; box-shadow: 0 0 0 4px var(--accent-soft); }
    .section-title { font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 800; letter-spacing: -0.03em; margin: 0; }
    .link-arrow {
      display: inline-flex; align-items: center; gap: 0.4rem; color: var(--accent); font-weight: 700; font-size: var(--fs-md);
      padding: 0.45rem 0.9rem; border-radius: 999px; background: var(--accent-soft);
      transition: gap 0.2s ease, background 0.2s ease;
    }
    .link-arrow:hover { gap: 0.65rem; background: color-mix(in srgb, var(--accent) 18%, transparent); }

    /* Catégories : halo qui suit la souris */
    .categories-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .category-card {
      --mx: 50%; --my: 50%;
      position: relative; overflow: hidden; display: flex; align-items: center; min-height: 124px; padding: 1.3rem;
      border-radius: var(--r-lg); border: 1px solid var(--border); color: var(--text);
      background: var(--surface); box-shadow: var(--shadow-sm);
      transition: border-color 0.25s ease, transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.25s ease;
    }
    .category-card::before {
      content: ''; position: absolute; inset: 0; opacity: 0; transition: opacity 0.25s;
      background: radial-gradient(220px circle at var(--mx) var(--my), color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%);
    }
    .category-card:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); transform: translateY(-4px); box-shadow: var(--shadow-lift); }
    .category-card:hover::before { opacity: 1; }
    .card-inner { position: relative; display: flex; flex-direction: column; }
    .cat-icon {
      display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 0.8rem; border-radius: var(--r-md);
      color: var(--accent); background: var(--accent-soft);
      transition: transform 0.3s cubic-bezier(0.3, 1.6, 0.5, 1), background 0.25s, color 0.25s;
    }
    .category-card:hover .cat-icon { transform: scale(1.1) rotate(-6deg); background: var(--accent); color: var(--on-accent); }
    .cat-title { font-family: var(--font-body); font-size: var(--fs-ui); font-weight: 700; margin: 0; line-height: 1.25; letter-spacing: -0.01em; }
    .cat-count { font-size: var(--fs-xs); color: var(--muted); margin-top: 0.2rem; font-variant-numeric: tabular-nums; }
    .cat-arrow { position: absolute; top: 1.1rem; right: 1.1rem; opacity: 0.35; color: var(--muted); transition: opacity 0.2s, color 0.2s, transform 0.25s; }
    .category-card:hover .cat-arrow { opacity: 1; color: var(--accent); transform: translate(2px, -2px); }
    .category-card.skeleton { border: none; box-shadow: none; }

    /* ------------------------------------------------------------ Configurateur */
    .config-band {
      position: relative; overflow: hidden; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 2.5rem; align-items: center;
      margin-top: 1.5rem; padding: 3rem; border-radius: 32px; color: #e8ecf6;
      background:
        radial-gradient(600px circle at 100% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 60%),
        radial-gradient(500px circle at 0% 100%, color-mix(in srgb, var(--sun) 16%, transparent), transparent 60%),
        linear-gradient(145deg, #121a31, #0a0f1f);
      border: 1px solid rgba(255, 255, 255, 0.06);
      box-shadow: 0 40px 70px -40px rgba(0, 0, 0, 0.6);
    }
    .config-band h2 { color: #fff; font-size: clamp(1.6rem, 3vw, 2.3rem); letter-spacing: -0.03em; max-width: 18ch; }
    .config-band h2 span { color: var(--sun); }
    .config-band p { color: #b8c2da; max-width: 52ch; line-height: 1.65; }
    .tag-label.light { color: #93a0bf; }
    .config-points { list-style: none; padding: 0; margin: 1.3rem 0 1.8rem; display: grid; gap: 0.65rem; }
    .config-points li { display: flex; align-items: center; gap: 0.65rem; font-weight: 600; font-size: var(--fs-ui); color: #dfe5f3; }
    .config-points app-icon { color: var(--sun); }

    .build-steps { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
    .build-steps li {
      position: relative; display: flex; align-items: center; gap: 0.7rem; padding: 0.75rem 0.85rem;
      border-radius: var(--r-md); border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.035);
      font-size: var(--fs-sm); font-weight: 600; color: #c5cde0;
      animation: step-on 8s ease-in-out infinite; animation-delay: calc(var(--i) * 0.45s);
    }
    .step-icon { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border-radius: 10px; background: rgba(255, 255, 255, 0.06); color: #9aa6c4; animation: inherit; animation-name: icon-on; }
    .step-check { margin-left: auto; color: #22c55e; opacity: 0; animation: inherit; animation-name: check-on; }
    @keyframes step-on {
      0%, 4% { border-color: rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.035); }
      10%, 70% { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 10%, transparent); color: #fff; }
      80%, 100% { border-color: rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.035); }
    }
    @keyframes icon-on {
      0%, 4% { background: rgba(255, 255, 255, 0.06); color: #9aa6c4; }
      10%, 70% { background: var(--accent); color: var(--on-accent); }
      80%, 100% { background: rgba(255, 255, 255, 0.06); color: #9aa6c4; }
    }
    @keyframes check-on { 0%, 6% { opacity: 0; transform: scale(0.4); } 12%, 70% { opacity: 1; transform: scale(1); } 80%, 100% { opacity: 0; transform: scale(0.4); } }

    /* ------------------------------------------------------------ Squelettes de chargement */
    .product-skeleton { padding: 0.6rem; }
    .sk-img { aspect-ratio: 4 / 3; border-radius: var(--r-xl); }
    .sk-line { height: 14px; border-radius: 6px; margin: 1rem 0.5rem 0; }
    .sk-line.short { width: 45%; margin-bottom: 0.8rem; }

    /* ------------------------------------------------------------ Atouts */
    .perks-wrap { padding-block: 1rem 1rem; }
    .perks { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .perk {
      display: flex; align-items: flex-start; gap: 0.85rem; padding: 1.2rem; border-radius: var(--r-lg);
      border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow-sm);
      transition: transform 0.25s, border-color 0.25s;
    }
    .perk:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
    .perk-icon { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 12px; background: var(--accent-soft); color: var(--accent); }
    .perk strong { font-size: var(--fs-ui); }
    .perk p { margin: 0.2rem 0 0; font-size: var(--fs-sm); color: var(--muted); line-height: 1.5; }

    /* ------------------------------------------------------------ Adaptation */
    @media (max-width: 980px) {
      .hero { grid-template-columns: 1fr; padding: 3rem 1.6rem; }
      .hero-showcase { height: 330px; }
      .float-card { width: 180px; }
      .config-band { grid-template-columns: 1fr; padding: 2rem 1.5rem; }
      .perks { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 560px) {
      .hero { border-radius: 28px; }
      .hero-showcase { display: none; }
      .stats { gap: 1.4rem; }
      .stats dd { font-size: var(--fs-2xl); }
      .build-steps { grid-template-columns: 1fr; }
      .perks { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      .shine, .pulse::after, .float-inner, .track, .build-steps li, .step-icon, .step-check { animation: none !important; }
      .step-check { opacity: 1; }
    }
  `,
})
export class HomePage {
  private api = inject(CatalogApi);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly steps = BUILD_STEPS;
  // i18n
  readonly perks: { icon: IconName; title: string; text: string }[] = [
    { icon: 'award', title: 'Prix clairs en TND', text: 'Tous les prix sont affichés en dinars tunisiens.' },
    { icon: 'truck', title: 'Paiement à la livraison', text: 'Ou PayPal, virement et carte, au choix.' },
    { icon: 'shield', title: 'Assemblages compatibles', text: 'Le configurateur écarte les pièces incompatibles.' },
    { icon: 'mail', title: 'Support à l’écoute', text: 'Une question ? L’équipe vous répond par e-mail.' },
  ];
  // /i18n

  private categories = toSignal(this.api.categories().pipe(catchError(() => of([] as CategoryNode[]))), {
    initialValue: [] as CategoryNode[],
  });
  private brands = toSignal(this.api.brands().pipe(catchError(() => of([] as Brand[]))), { initialValue: [] as Brand[] });

  readonly tiles = computed(() =>
    this.categories()
      .flatMap((root) => (root.children.length ? root.children : [root]))
      .filter((c) => c._count.products > 0)
      .sort((a, b) => b._count.products - a._count.products),
  );

  readonly stats = computed(() => ({
    products: this.tiles().reduce((sum, c) => sum + c._count.products, 0),
    categories: this.tiles().length,
    brands: this.brands().length,
  }));

  /** Marques connues présentes en base, doublées pour un défilement sans couture */
  readonly brandStrip = computed(() => {
    const byName = new Map(this.brands().map((b) => [b.name.toLowerCase(), b]));
    const found = FEATURED_BRANDS.map((n) => byName.get(n.toLowerCase())).filter((b): b is Brand => !!b);
    return found.length >= 6 ? [...found, ...found] : [];
  });

  readonly latest = toSignal<Paginated<ProductListItem> | null>(
    this.api.products({ limit: '4', sort: 'newest' }).pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  /**
   * Vitrine du bandeau : 3 produits phares tirés au hasard par l'API à chaque chargement
   * (favoris des clients avec une belle photo ; cartes graphiques, écrans, claviers,
   * processeurs et RAM en priorité ; jamais de webcams ni d'enceintes).
   */
  readonly showcase = toSignal(this.api.showcase().pipe(catchError(() => of([] as ProductListItem[]))), {
    initialValue: [] as ProductListItem[],
  });

  // ------------------------------------------------------------ Interactions

  /** Parallaxe et halo du bandeau selon la position de la souris */
  onHeroPointer(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return;
    const hero = event.currentTarget as HTMLElement;
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    hero.style.setProperty('--px', (x * 2 - 1).toFixed(3));
    hero.style.setProperty('--py', (y * 2 - 1).toFixed(3));
    hero.style.setProperty('--sx', `${(x * 100).toFixed(1)}%`);
    hero.style.setProperty('--sy', `${(y * 100).toFixed(1)}%`);
  }

  resetHeroPointer() {
    const hero = this.host.nativeElement.querySelector<HTMLElement>('.hero');
    hero?.style.setProperty('--px', '0');
    hero?.style.setProperty('--py', '0');
  }

  /** Halo qui suit la souris sur une tuile de catégorie */
  onSpot(event: PointerEvent) {
    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    card.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }

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
    if (/boitier|case/.test(s)) return 'box';
    return 'box';
  }
}
