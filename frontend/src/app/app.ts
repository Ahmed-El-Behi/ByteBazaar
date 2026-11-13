import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from './components/icon';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth-service';
import { CartStateService } from './core/cart.service';
import { ThemeService } from './core/theme.service';
import { I18nService, TPipe } from './core/i18n';
import { Cursor } from './components/cursor';
import { Toaster } from './components/toaster';
import { Ambient } from './components/ambient';

@Component({
  selector: 'app-root',
  imports: [Icon, RouterOutlet, RouterLink, RouterLinkActive, Cursor, TPipe, Toaster, Ambient],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  readonly cartState = inject(CartStateService);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private router = inject(Router);
  private readonly nav = viewChild<ElementRef<HTMLElement>>('nav');
  private indicatorLeft: number | null = null;

  readonly searchOpen = signal(false);
  /** Page défilée : l'en-tête devient plus compact et plus marqué */
  readonly scrolled = signal(false);
  /** Petit « rebond » du badge du panier quand son nombre d'articles change */
  readonly cartBump = signal(false);

  constructor() {
    // Pastille de navigation : suit la page active (changement de page, de taille, de langue…)
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const nav = this.nav()?.nativeElement;
      if (!nav) return;
      const place = () => requestAnimationFrame(() => this.moveIndicator(false));
      // Seule la fin d'une navigation peut effacer la pastille (page hors menu) :
      // pendant la navigation, le lien actif disparaît un instant, la pastille reste où elle est
      const navigation = this.router.events.subscribe((e) => {
        if (e instanceof NavigationEnd) requestAnimationFrame(() => this.moveIndicator(true));
      });
      const resize = new ResizeObserver(place);
      resize.observe(nav);
      // Liens ajoutés ou retirés (liens d'administration après connexion)
      const mutations = new MutationObserver(place);
      mutations.observe(nav, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
      document.fonts?.ready.then(place);
      requestAnimationFrame(() => this.moveIndicator(true));
      destroyRef.onDestroy(() => {
        navigation.unsubscribe();
        resize.disconnect();
        mutations.disconnect();
      });
    });

    if (typeof window !== 'undefined') {
      const onScroll = () => this.scrolled.set(window.scrollY > 8);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    let previous = this.cartState.itemCount();
    effect(() => {
      const count = this.cartState.itemCount();
      if (count > previous) {
        this.cartBump.set(false);
        requestAnimationFrame(() => this.cartBump.set(true));
      }
      previous = count;
    });
  }

  // Clic sur la loupe : ouvre le champ ; s'il est déjà ouvert, lance la recherche (ou le referme s'il est vide)
  toggleSearch(input: HTMLInputElement) {
    if (!this.searchOpen()) {
      this.searchOpen.set(true);
      setTimeout(() => input.focus(), 0);
      return;
    }
    if (input.value.trim()) {
      this.router.navigate(['/produits'], { queryParams: { q: input.value.trim() } });
    } else {
      this.searchOpen.set(false);
      input.blur();
    }
  }

  /** Place la pastille sous le lien actif ; elle glisse (et s'étire) depuis sa position précédente. */
  private moveIndicator(allowHide: boolean) {
    const nav = this.nav()?.nativeElement;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('a.active');
    if (!active) {
      // Page hors menu (panier, compte…) : la pastille s'efface sur place
      if (allowHide) nav.style.setProperty('--ind-o', '0');
      return;
    }
    const left = active.offsetLeft;
    const right = nav.clientWidth - (left + active.offsetWidth);
    if (this.indicatorLeft !== null && left !== this.indicatorLeft) {
      nav.dataset['dir'] = left > this.indicatorLeft ? 'right' : 'left';
    }
    nav.style.setProperty('--ind-l', `${left}px`);
    nav.style.setProperty('--ind-r', `${right}px`);
    nav.style.setProperty('--ind-o', '1');
    // Premier placement sans animation, puis glissements animés
    if (this.indicatorLeft === null) requestAnimationFrame(() => nav.classList.add('ind-ready'));
    this.indicatorLeft = left;
  }

  closeSearch(input: HTMLInputElement) {
    input.value = '';
    input.blur();
    this.searchOpen.set(false);
  }

  onSearchBlur(input: HTMLInputElement) {
    if (!input.value.trim()) this.searchOpen.set(false);
  }

  search(event: Event, value: string) {
    event.preventDefault();
    this.router.navigate(['/produits'], { queryParams: { q: value.trim() || null } });
  }
}
