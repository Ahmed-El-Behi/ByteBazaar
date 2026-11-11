import { Routes } from '@angular/router';
import { HomePage } from './pages/home';
import { ProductListPage } from './pages/product-list';
import { ProductDetailPage } from './pages/product-detail';
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { ResetPasswordPage } from './pages/reset-password';
import { AccountPage } from './pages/account';
import { AccountProfilePage } from './pages/account-profile';
import { AccountOrdersPage } from './pages/account-orders';
import { AccountConfigurationsPage } from './pages/account-configurations';
import { CartPage } from './pages/cart';
import { CheckoutPage } from './pages/checkout';
import { OrderDetailPage } from './pages/order-detail';
import { ContactPage } from './pages/contact';
import { AboutPage } from './pages/about';
import { authGuard } from './core/auth-guard';
import { adminGuard } from './core/admin.guard';
import { pendingChangesGuard } from './core/pending-changes.guard';

export const routes: Routes = [
  // --- ACCUEIL & CATALOGUE ---
  { path: '', component: HomePage, title: 'ByteBazaar · Composants PC en Tunisie' },
  { path: 'produits', component: ProductListPage, title: 'Catalogue · ByteBazaar' },
  { path: 'catalogue', redirectTo: 'produits', pathMatch: 'full' }, // Alias de secours pour routerLink="/catalogue"
  { path: 'produits/:slug', component: ProductDetailPage, title: 'Produit · ByteBazaar' },

  // --- PAGES D'INFORMATION ---
  { path: 'contact', component: ContactPage, title: 'Contactez-nous · ByteBazaar' },
  { path: 'a-propos', component: AboutPage, title: 'À propos · ByteBazaar' },

  // --- AUTHENTIFICATION ---
  { path: 'connexion', component: LoginPage, title: 'Connexion · ByteBazaar' },
  { path: 'inscription', component: RegisterPage, title: 'Inscription · ByteBazaar' },
  { path: 'reset-password', component: ResetPasswordPage, title: 'Réinitialisation · ByteBazaar' },
  { path: 'nouveau-mot-de-passe', redirectTo: 'reset-password', pathMatch: 'full' },

  // --- PANIER & COMMANDE ---
  { path: 'panier', component: CartPage, title: 'Mon Panier · ByteBazaar' },
  { path: 'checkout', component: CheckoutPage, canActivate: [authGuard], title: 'Commande · ByteBazaar' },
  { path: 'commandes/:id', component: OrderDetailPage, canActivate: [authGuard], title: 'Confirmation · ByteBazaar' },

  // --- ESPACE CLIENT ---
  {
    path: 'compte',
    component: AccountPage,
    canActivate: [authGuard],
    title: 'Mon compte · ByteBazaar',
    children: [
      { path: '', redirectTo: 'profil', pathMatch: 'full' },
      { 
        path: 'profil', 
        component: AccountProfilePage,
        canDeactivate: [pendingChangesGuard]
      },
      { path: 'commandes', component: AccountOrdersPage },
      { path: 'configurations', component: AccountConfigurationsPage }
    ]
  },
  { path: 'mes-commandes', redirectTo: 'compte/commandes', pathMatch: 'full' },

  // --- ADMINISTRATION ---
  {
    path: 'admin/commandes',
    loadComponent: () => import('./pages/admin-orders').then((m) => m.AdminOrdersPage),
    canActivate: [adminGuard],
    title: 'Gestion des commandes · Admin ByteBazaar',
  },
  {
    path: 'admin/stock',
    loadComponent: () => import('./pages/admin-stock').then((m) => m.AdminStockPage),
    canActivate: [adminGuard],
    title: 'Gestion des stocks · Admin ByteBazaar',
  },

  // --- ROUTE DE SECOURS (TOUJOURS EN DERNIER) ---
  { path: '**', redirectTo: '' }
];