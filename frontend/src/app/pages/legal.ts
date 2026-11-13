import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../components/icon';
import { I18nService, TPipe } from '../core/i18n';
import { LEGAL_CONTACT, LEGAL_DOCS, LEGAL_UPDATED, type LegalDocId } from '../core/legal-content';

/**
 * Pages juridiques : conditions générales de vente (/conditions) et politique de
 * confidentialité (/confidentialite). Contenu dans core/legal-content.ts (FR / EN).
 */
@Component({
  selector: 'app-legal',
  imports: [RouterLink, Icon, TPipe],
  template: `
    <div class="container page">
      <header class="legal-head">
        <p class="eyebrow">
          <app-icon [name]="doc() === 'privacy' ? 'shield' : 'fileText'" [size]="15" />
          {{ 'Informations légales' | t }}
        </p>
        <h1>{{ content().title }}</h1>
        <p class="lead">{{ content().lead }}</p>
        <div class="meta">
          <span>{{ 'Dernière mise à jour : {date}' | t: { date: updated() } }}</span>
          <button type="button" class="btn small" (click)="print()">
            <app-icon name="printer" [size]="15" /> {{ 'Imprimer' | t }}
          </button>
        </div>

        <nav class="doc-tabs" [attr.aria-label]="'Documents légaux' | t">
          <a routerLink="/conditions" [class.active]="doc() === 'terms'">
            <app-icon name="fileText" [size]="16" /> {{ 'Conditions générales de vente' | t }}
          </a>
          <a routerLink="/confidentialite" [class.active]="doc() === 'privacy'">
            <app-icon name="shield" [size]="16" /> {{ 'Politique de confidentialité' | t }}
          </a>
        </nav>
      </header>

      <div class="layout">
        <aside class="toc">
          <p class="toc-title">{{ 'Sommaire' | t }}</p>
          <ol>
            @for (s of content().sections; track s.id; let i = $index) {
              <li>
                <button type="button" [class.active]="activeId() === s.id" (click)="goTo(s.id)">
                  <span class="toc-num">{{ i + 1 }}</span> {{ s.title }}
                </button>
              </li>
            }
          </ol>
        </aside>

        <article class="doc">
          <section class="summary">
            <h2>{{ content().summaryTitle }}</h2>
            <ul>
              @for (item of content().summary; track item) {
                <li>
                  <app-icon name="checkCircle" [size]="17" /> <span>{{ item }}</span>
                </li>
              }
            </ul>
          </section>

          @for (s of content().sections; track s.id; let i = $index) {
            <section class="clause" [id]="'section-' + s.id" [attr.data-section]="s.id">
              <h2>
                <span class="num">{{ i + 1 }}.</span> {{ s.title }}
              </h2>
              @for (p of s.paragraphs ?? []; track $index) {
                <p [innerHTML]="p"></p>
              }
              @if (s.list?.length) {
                <ul>
                  @for (item of s.list; track $index) {
                    <li [innerHTML]="item"></li>
                  }
                </ul>
              }
              @for (p of s.after ?? []; track $index) {
                <p [innerHTML]="p"></p>
              }
            </section>
          }

          <section class="contact-card">
            <span class="contact-icon"><app-icon name="mail" [size]="20" /></span>
            <div>
              <strong>{{ 'Une question sur ce document ?' | t }}</strong>
              <p>{{ 'Notre équipe vous répond par e-mail, du lundi au samedi.' | t }}</p>
            </div>
            <a class="btn primary small" [href]="'mailto:' + contact">{{ contact }}</a>
          </section>

          <p class="other-doc">
            @if (doc() === 'terms') {
              <a routerLink="/confidentialite"
                >{{ 'Lire la politique de confidentialité' | t }}
                <app-icon name="arrowRight" [size]="15"
              /></a>
            } @else {
              <a routerLink="/conditions"
                >{{ 'Lire les conditions générales de vente' | t }}
                <app-icon name="arrowRight" [size]="15"
              /></a>
            }
          </p>
        </article>
      </div>
    </div>
  `,
  styles: `
    .page {
      padding-block: 2.5rem 3rem;
      max-width: 1120px;
    }

    .legal-head {
      padding-bottom: 1.6rem;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0 0 0.9rem;
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: var(--fs-xs);
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      font-size: clamp(2rem, 4vw, 2.8rem);
      letter-spacing: -0.035em;
      margin-bottom: 0.7rem;
    }
    .lead {
      max-width: 70ch;
      margin: 0 0 1.2rem;
      color: var(--text-2);
      font-size: var(--fs-lg);
      line-height: 1.6;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: var(--fs-sm);
    }
    .doc-tabs {
      display: inline-flex;
      gap: 0.3rem;
      margin-top: 1.5rem;
      padding: 0.3rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      flex-wrap: wrap;
    }
    .doc-tabs a {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 1rem;
      border-radius: 999px;
      font-size: var(--fs-md);
      font-weight: 700;
      color: var(--muted);
      transition:
        background 0.2s,
        color 0.2s;
    }
    .doc-tabs a:hover {
      color: var(--text);
      background: var(--surface-2);
    }
    .doc-tabs a.active {
      background: var(--accent-soft);
      color: var(--accent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent);
    }

    .layout {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 2.5rem;
      align-items: start;
    }

    .toc {
      position: sticky;
      top: 90px;
      max-height: calc(100vh - 110px);
      overflow-y: auto;
    }
    .toc-title {
      margin: 0 0 0.6rem;
      font-size: var(--fs-xs);
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .toc ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1px;
      border-left: 2px solid var(--border);
    }
    .toc button {
      position: relative;
      display: flex;
      gap: 0.55rem;
      width: 100%;
      padding: 0.42rem 0.7rem;
      margin-left: -2px;
      border: 0;
      border-left: 2px solid transparent;
      background: none;
      text-align: left;
      color: var(--muted);
      font-size: var(--fs-sm);
      font-weight: 600;
      line-height: 1.35;
      transition:
        color 0.2s,
        border-color 0.2s,
        background 0.2s;
    }
    .toc button:hover {
      color: var(--text);
    }
    .toc button.active {
      color: var(--accent);
      border-left-color: var(--accent);
      background: linear-gradient(90deg, var(--accent-soft), transparent);
    }
    .toc-num {
      flex: none;
      min-width: 1.2rem;
      font-variant-numeric: tabular-nums;
      opacity: 0.7;
    }

    .doc {
      min-width: 0;
    }
    .summary {
      margin-bottom: 2.2rem;
      padding: 1.4rem 1.5rem;
      border-radius: var(--r-xl);
      border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
      background:
        radial-gradient(
          500px circle at 0% 0%,
          color-mix(in srgb, var(--accent) 8%, transparent),
          transparent 60%
        ),
        var(--card-bg);
      box-shadow: var(--shadow-sm);
    }
    .summary h2 {
      font-size: var(--fs-lg);
      margin-bottom: 0.9rem;
    }
    .summary ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.7rem 1.4rem;
    }
    .summary li {
      display: flex;
      gap: 0.6rem;
      font-size: var(--fs-md);
      color: var(--text-2);
      line-height: 1.5;
    }
    .summary app-icon {
      flex: none;
      color: var(--green);
      margin-top: 1px;
    }

    .clause {
      padding-block: 0.4rem 1.4rem;
      margin-bottom: 1.2rem;
      border-bottom: 1px solid var(--border);
      scroll-margin-top: 96px;
    }
    .clause:last-of-type {
      border-bottom: 0;
    }
    .clause h2 {
      display: flex;
      gap: 0.5rem;
      font-size: var(--fs-xl);
      letter-spacing: -0.02em;
      margin-bottom: 0.8rem;
    }
    .num {
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }
    .clause p,
    .clause li {
      color: var(--text-2);
      font-size: var(--fs-base);
      line-height: 1.75;
    }
    .clause p {
      margin: 0 0 0.85rem;
    }
    .clause ul {
      margin: 0 0 0.85rem;
      padding-left: 1.3rem;
    }
    .clause li {
      margin-bottom: 0.35rem;
    }
    .clause li::marker {
      color: var(--accent);
    }
    .clause :is(p, li) strong {
      color: var(--text);
      font-weight: 700;
    }

    .contact-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      margin-top: 1rem;
      padding: 1.2rem 1.4rem;
      border-radius: var(--r-xl);
      border: 1px solid var(--border);
      background: var(--card-bg);
      box-shadow: var(--shadow-sm);
    }
    .contact-card > div {
      flex: 1;
      min-width: 200px;
    }
    .contact-card p {
      margin: 0.15rem 0 0;
      color: var(--muted);
      font-size: var(--fs-sm);
    }
    .contact-icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      flex: none;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--accent), var(--pink));
      color: #fff;
    }
    .other-doc {
      margin: 1.4rem 0 0;
      text-align: right;
    }
    .other-doc a {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-weight: 700;
      color: var(--accent);
    }
    .other-doc a:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .toc {
        position: static;
        max-height: none;
      }
      .summary ul {
        grid-template-columns: 1fr;
      }
    }

    /* Impression : document seul, sans navigation */
    @media print {
      .doc-tabs,
      .toc,
      .meta .btn,
      .contact-card .btn,
      .other-doc {
        display: none !important;
      }
      .layout {
        display: block;
      }
      .clause {
        break-inside: avoid-page;
      }
    }
  `,
})
export class LegalPage {
  /** Document affiché (données de la route) */
  readonly doc = input<LegalDocId>('terms');

  private readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly contact = LEGAL_CONTACT;
  readonly activeId = signal<string | null>(null);

  readonly content = computed(() => LEGAL_DOCS[this.doc()][this.i18n.lang()]);
  readonly updated = computed(() =>
    new Intl.DateTimeFormat(this.i18n.locale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(LEGAL_UPDATED)),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    let frame = 0;

    // Sommaire : la section en cours est la dernière dont le titre a passé le haut de l'écran
    const update = () => {
      frame = 0;
      const clauses = Array.from(this.host.querySelectorAll<HTMLElement>('.clause'));
      if (!clauses.length) return;
      let current = clauses[0];
      for (const el of clauses) {
        if (el.getBoundingClientRect().top <= 140) current = el;
        else break;
      }
      // Bas de page atteint : la dernière section est active
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4)
        current = clauses[clauses.length - 1];
      this.activeId.set(current.dataset['section'] ?? null);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    afterNextRender(() => {
      window.addEventListener('scroll', onScroll, { passive: true });
      update();
    });
    // Changement de document ou de langue : recalcul après le rendu
    effect(() => {
      this.content();
      setTimeout(update);
    });
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    });
  }

  goTo(id: string) {
    this.host
      .querySelector(`#section-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  print() {
    window.print();
  }
}
