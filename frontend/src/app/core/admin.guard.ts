import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth-service';

// Après un rechargement, le profil (et donc le rôle) n'est pas encore connu :
// on attend la réponse de /auth/me avant de décider.
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toLogin = router.createUrlTree(['/connexion'], { queryParams: { redirect: state.url } });

  if (!auth.isLoggedIn()) return toLogin;
  return auth.ensureUser().pipe(map((user) => (user?.role === 'ADMIN' ? true : router.parseUrl('/'))));
};
