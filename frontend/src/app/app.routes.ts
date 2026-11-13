import { Routes } from '@angular/router';
import { adminGuard } from './core/admin.guard';
import { authGuard } from './core/auth-guard';
import { pendingChangesGuard } from './core/pending-changes.guard';
import { HomePage } from './pages/home';
import { ProductListPage } from './pages/product-list';

// L'accueil et le catalogue (pages d'entrée) sont dans le bundle initial ; les autres pages
// sont chargées à la demande. Titres en français, traduits par TranslatedTitleStrategy.
// i18n
export const routes: Routes = [
  { path: '', component: HomePage, title: 'ByteBazaar · Composants PC en Tunisie' },
  { path: 'produits', component: ProductListPage, title: 'Catalogue · ByteBazaar' },
  { path: 'catalogue', redirectTo: 'produits', pathMatch: 'full' },
  {
    path: 'produits/:slug',
    loadComponent: () => import('./pages/product-detail').then((m) => m.ProductDetailPage),
    title: 'Produit · ByteBazaar',
  },
  {
    path: 'configurateur',
    loadComponent: () => import('./pages/configurator').then((m) => m.ConfiguratorPage),
    title: 'Configurateur PC · ByteBazaar',
  },

  {
    path: 'contact',
    loadComponent: () => import('./pages/contact').then((m) => m.ContactPage),
    title: 'Contactez-nous · ByteBazaar',
  },
  {
    path: 'a-propos',
    loadComponent: () => import('./pages/about').then((m) => m.AboutPage),
    title: 'À propos · ByteBazaar',
  },
  {
    path: 'conditions',
    loadComponent: () => import('./pages/legal').then((m) => m.LegalPage),
    data: { doc: 'terms' },
    title: 'Conditions générales de vente · ByteBazaar',
  },
  {
    path: 'confidentialite',
    loadComponent: () => import('./pages/legal').then((m) => m.LegalPage),
    data: { doc: 'privacy' },
    title: 'Politique de confidentialité · ByteBazaar',
  },

  {
    path: 'connexion',
    loadComponent: () => import('./pages/login').then((m) => m.LoginPage),
    title: 'Connexion · ByteBazaar',
  },
  {
    path: 'inscription',
    loadComponent: () => import('./pages/register').then((m) => m.RegisterPage),
    title: 'Inscription · ByteBazaar',
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password').then((m) => m.ResetPasswordPage),
    title: 'Réinitialisation · ByteBazaar',
  },
  { path: 'nouveau-mot-de-passe', redirectTo: 'reset-password', pathMatch: 'full' },

  {
    path: 'panier',
    loadComponent: () => import('./pages/cart').then((m) => m.CartPage),
    title: 'Mon Panier · ByteBazaar',
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout').then((m) => m.CheckoutPage),
    canActivate: [authGuard],
    title: 'Commande · ByteBazaar',
  },
  {
    path: 'commandes/:id',
    loadComponent: () => import('./pages/order-detail').then((m) => m.OrderDetailPage),
    canActivate: [authGuard],
    title: 'Confirmation · ByteBazaar',
  },

  {
    path: 'compte',
    loadComponent: () => import('./pages/account').then((m) => m.AccountPage),
    canActivate: [authGuard],
    title: 'Mon compte · ByteBazaar',
    children: [
      { path: '', redirectTo: 'profil', pathMatch: 'full' },
      {
        path: 'profil',
        loadComponent: () => import('./pages/account-profile').then((m) => m.AccountProfilePage),
        canDeactivate: [pendingChangesGuard],
      },
      {
        path: 'commandes',
        loadComponent: () => import('./pages/account-orders').then((m) => m.AccountOrdersPage),
      },
      {
        path: 'configurations',
        loadComponent: () =>
          import('./pages/account-configurations').then((m) => m.AccountConfigurationsPage),
      },
    ],
  },
  { path: 'mes-commandes', redirectTo: 'compte/commandes', pathMatch: 'full' },

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

  { path: '**', redirectTo: '' },
];
// /i18n
