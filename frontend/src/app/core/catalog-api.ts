import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { shareReplay } from 'rxjs';
import { API_URL, Brand, CategoryNode, Paginated, ProductDetail, ProductListItem } from './models';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private http = inject(HttpClient);

  // Catégories, marques et photos de catégories ne changent pas pendant une visite :
  // chargées une seule fois et partagées entre l'accueil et le catalogue
  // (une requête en échec n'est pas mémorisée : elle sera retentée).
  private readonly categories$ = this.http
    .get<CategoryNode[]>(`${API_URL}/categories`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));
  private readonly covers$ = this.http
    .get<Record<string, { url: string; altText: string | null }>>(`${API_URL}/categories/covers`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));
  private readonly brands$ = this.http
    .get<Brand[]>(`${API_URL}/brands`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  categories() {
    return this.categories$;
  }

  categoryCovers() {
    return this.covers$;
  }

  brands() {
    return this.brands$;
  }

  products(query: Record<string, string>) {
    return this.http.get<Paginated<ProductListItem>>(`${API_URL}/products`, { params: query });
  }

  /** 3 produits phares pour la vitrine de l'accueil (différents à chaque appel) */
  showcase() {
    return this.http.get<ProductListItem[]>(`${API_URL}/products/showcase`);
  }

  product(slug: string) {
    return this.http.get<ProductDetail>(`${API_URL}/products/${encodeURIComponent(slug)}`);
  }
}
