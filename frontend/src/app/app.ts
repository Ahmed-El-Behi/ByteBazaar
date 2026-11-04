import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth-service';
import { CartStateService } from './core/cart.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  readonly cartState = inject(CartStateService);
  private router = inject(Router);

  search(event: Event, value: string) {
    event.preventDefault();
    this.router.navigate(['/produits'], { queryParams: { q: value.trim() || null } });
  }
}