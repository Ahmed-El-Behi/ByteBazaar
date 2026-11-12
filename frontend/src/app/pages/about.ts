import { Component } from '@angular/core';
import { Icon } from '../components/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [Icon, RouterLink],
  template: `
    <div class="container page">
      <div class="hero-section">
        <span class="badge">À propos de ByteBazaar</span>
        <h1>Le bazar des <span>composants PC</span> en Tunisie</h1>
        <p class="subtitle muted">
          ByteBazaar est né avec une mission simple : proposer le meilleur des composants high-tech au prix le plus juste en Tunisie, avec une transparence totale sur les prix et la compatibilité.
        </p>
      </div>

      <!-- CARTE D'INFORMATIONS AVEC HOVER & SHADOW DYNAMIQUE (BLEU EN LIGHT / GOLD EN DARK) -->
      <div class="features-grid">
        <div class="card feature-card">
          <div class="feature-icon">
            <app-icon name="award" [size]="22" />
          </div>
          <h3>Multi-marques & Authentique</h3>
          <p class="muted">
            Nous collaborons directement avec les plus grands constructeurs (Asus, MSI, Corsair, AMD, Intel, NVIDIA) pour vous garantir des produits originaux sous garantie.
          </p>
        </div>

        <div class="card feature-card">
          <div class="feature-icon">
            <app-icon name="wrench" [size]="22" />
          </div>
          <h3>Configurateur sur mesure</h3>
          <p class="muted">
            Notre outil de configuration intelligent vérifie la compatibilité de vos composants en temps réel pour créer la machine de vos rêves sans mauvaise surprise.
          </p>
        </div>

        <div class="card feature-card">
          <div class="feature-icon">
            <app-icon name="truck" [size]="22" />
          </div>
          <h3>Livraison rapide en Tunisie</h3>
          <p class="muted">
            Commandez en toute confiance avec notre système de livraison à domicile partout en Tunisie et le paiement sécurisé à la livraison.
          </p>
        </div>
      </div>

      <!-- STATISTIQUES -->
      <div class="card stats-card">
        <div class="stat-item">
          <span class="stat-number">100%</span>
          <span class="stat-label">Produits garantis</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">24h</span>
          <span class="stat-label">Support réactif</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">TND</span>
          <span class="stat-label">Prix transparents</span>
        </div>
      </div>

      <!-- CTA BOX -->
      <div class="card cta-box">
        <h2>Prêt à assembler votre prochain PC ?</h2>
        <a routerLink="/produits" class="btn primary">Découvrir le catalogue</a>
      </div>
    </div>
  `,
  styles: `
    .page {
      padding-block: 3.5rem;
      max-width: 1050px;
      margin-inline: auto;
    }
    .hero-section {
      text-align: center;
      margin-bottom: 3.5rem;
    }
    .badge {
      display: inline-block;
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent, var(--accent));
      padding: 0.4rem 1.1rem;
      border-radius: var(--r-lg);
      font-size: var(--fs-md);
      font-weight: 600;
      margin-bottom: 1.2rem;
    }
    .hero-section h1 {
      font-size: var(--fs-4xl);
      font-weight: 800;
      margin-bottom: 1rem;
      color: var(--text, inherit);
    }
    .hero-section h1 span {
      color: var(--accent, var(--accent));
    }
    .subtitle {
      font-size: var(--fs-base);
      max-width: 720px;
      margin-inline: auto;
      line-height: 1.6;
      color: var(--muted, #8c94a4);
    }

    /* GRILLE ET CARTES */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      margin-bottom: 3rem;
    }
    @media (max-width: 800px) {
      .features-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--surface-1, var(--surface, rgba(255, 255, 255, 0.03)));
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      border-radius: var(--r-lg);
      padding: 2rem;
    }

    .feature-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), 
                  border-color 0.3s ease, 
                  box-shadow 0.3s ease;
      cursor: default;
    }

    /* HOVER EN MODE CLAIR (BLEU) */
    .feature-card:hover {
      transform: translateY(-8px);
      border-color: var(--accent);
      box-shadow: 0 14px 32px -8px color-mix(in srgb, var(--accent) 25%, transparent),
                  0 4px 12px rgba(0, 0, 0, 0.05);
    }

    /* HOVER EN MODE SOMBRE (ORANGE / ACCENT) */
    :host-context([data-theme="dark"]) .feature-card:hover,
    :host-context(.dark) .feature-card:hover,
    html[data-theme="dark"] .feature-card:hover {
      border-color: color-mix(in srgb, var(--accent) 50%, transparent);
      box-shadow: 0 14px 32px -8px color-mix(in srgb, var(--accent) 25%, transparent),
                  0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .feature-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--r-md);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      color: var(--accent, var(--accent));
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease, background 0.3s ease;
    }
    .feature-card:hover .feature-icon {
      transform: scale(1.08);
      background: color-mix(in srgb, var(--accent) 20%, transparent);
    }

    .feature-card h3 {
      font-size: var(--fs-lg);
      font-weight: 700;
      color: var(--text, inherit);
      margin: 0;
    }
    .feature-card p {
      font-size: var(--fs-ui);
      line-height: 1.55;
      margin: 0;
      color: var(--muted, #8c94a4);
    }

    /* STATISTIQUES */
    .stats-card {
      display: flex;
      justify-content: space-around;
      align-items: center;
      text-align: center;
      margin-bottom: 3rem;
      padding-block: 2.2rem;
      transition: border-color 0.3s ease;
    }
    .stats-card:hover {
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    }
    :host-context([data-theme="dark"]) .stats-card:hover,
    html[data-theme="dark"] .stats-card:hover {
      border-color: color-mix(in srgb, var(--accent) 30%, transparent);
    }

    @media (max-width: 600px) {
      .stats-card { flex-direction: column; gap: 1.5rem; }
    }
    .stat-number {
      display: block;
      font-size: var(--fs-4xl);
      font-weight: 800;
      color: var(--accent, var(--accent));
      line-height: 1.1;
    }
    .stat-label {
      font-size: var(--fs-md);
      color: var(--muted, #8c94a4);
    }

    /* CTA BOX */
    .cta-box {
      text-align: center;
      border-radius: var(--r-lg);
      padding: 3rem 2rem;
      transition: border-color 0.3s ease;
    }
    .cta-box:hover {
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    }
    :host-context([data-theme="dark"]) .cta-box:hover,
    html[data-theme="dark"] .cta-box:hover {
      border-color: color-mix(in srgb, var(--accent) 30%, transparent);
    }

    .cta-box h2 {
      margin-bottom: 1.5rem;
      font-weight: 700;
      color: var(--text, inherit);
    }
    .btn.primary {
      background: var(--accent, var(--accent));
      color: var(--on-accent);
      font-weight: 600;
      padding: 0.85rem 2rem;
      border-radius: var(--r-xl);
      border: none;
      text-decoration: none;
      display: inline-block;
      transition: opacity 0.2s, transform 0.2s;
    }
    .btn.primary:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }
  `,
})
export class AboutPage {}