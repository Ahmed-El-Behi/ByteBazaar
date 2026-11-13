import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL, Brand, CategoryNode, Paginated, ProductDetail, ProductListItem } from './models';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private http = inject(HttpClient);

  categories() {
    return this.http.get<CategoryNode[]>(`${API_URL}/categories`);
  }

  categoryCovers() {
    return this.http.get<Record<string, { url: string; altText: string | null }>>(
      `${API_URL}/categories/covers`,
    );
  }

  brands() {
    return this.http.get<Brand[]>(`${API_URL}/brands`);
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
