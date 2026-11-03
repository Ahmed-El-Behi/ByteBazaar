import { Routes } from '@angular/router';
import { HomePage } from './pages/home';
import { ProductListPage } from './pages/product-list';
import { ProductDetailPage } from './pages/product-detail';
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { AccountPage } from './pages/account';
import { authGuard } from './core/auth-guard';

export const routes: Routes = [
  { path: '', component: HomePage, title: 'ByteBazaar · Composants PC en Tunisie' },
  { path: 'produits', component: ProductListPage, title: 'Catalogue · ByteBazaar' },
  { path: 'produits/:slug', component: ProductDetailPage, title: 'Produit · ByteBazaar' },
  { path: 'connexion', component: LoginPage, title: 'Connexion · ByteBazaar' },
  { path: 'inscription', component: RegisterPage, title: 'Inscription · ByteBazaar' },
  { path: 'compte', component: AccountPage, canActivate: [authGuard], title: 'Mon compte · ByteBazaar' },
  { path: '**', redirectTo: '' },
];