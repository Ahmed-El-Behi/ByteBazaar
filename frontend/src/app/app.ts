import { Component, inject, signal } from '@angular/core';
import { Icon } from './components/icon';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth-service';
import { CartStateService } from './core/cart.service';
import { ThemeService } from './core/theme.service';
import { Cursor } from './components/cursor';

@Component({
  selector: 'app-root',
  imports: [Icon, RouterOutlet, RouterLink, RouterLinkActive, Cursor],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  readonly cartState = inject(CartStateService);
  readonly theme = inject(ThemeService);
  private router = inject(Router);

  readonly searchOpen = signal(false);

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