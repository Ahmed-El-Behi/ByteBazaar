import { Routes } from '@angular/router';
import { HomePage } from './pages/home';
import { ProductListPage } from './pages/product-list';
import { ProductDetailPage } from './pages/product-detail';

export const routes: Routes = [
  { path: '', component: HomePage, title: 'ByteBazaar · Composants PC en Tunisie' },
  { path: 'produits', component: ProductListPage, title: 'Catalogue · ByteBazaar' },
  { path: 'produits/:slug', component: ProductDetailPage, title: 'Produit · ByteBazaar' },
  { path: '**', redirectTo: '' },
];