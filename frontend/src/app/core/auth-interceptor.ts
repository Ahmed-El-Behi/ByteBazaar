import { HttpInterceptorFn } from '@angular/common/http';
import { currentLang } from './i18n';
import { API_URL } from './models';
import { readToken } from './token-storage';

// Requêtes vers notre API uniquement :
//  - "Accept-Language" : l'API répond dans la langue choisie sur le site (messages, erreurs) ;
//  - "Authorization: Bearer ..." si l'utilisateur est connecté.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL)) return next(req);
  const token = readToken();
  return next(
    req.clone({
      setHeaders: { 'Accept-Language': currentLang(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }),
  );
};
