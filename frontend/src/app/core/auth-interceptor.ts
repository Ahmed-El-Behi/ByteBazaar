import { HttpInterceptorFn } from '@angular/common/http';
import { API_URL } from './models';
import { readToken } from './token-storage';

// Ajoute "Authorization: Bearer ..." aux requêtes vers notre API uniquement
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = readToken();
  if (!token || !req.url.startsWith(API_URL)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};