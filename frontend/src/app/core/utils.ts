import { HttpErrorResponse } from '@angular/common/http';

// Transforme une erreur HTTP du backend en liste de messages lisibles
export function apiErrors(error: unknown): string[] {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return ['Serveur injoignable. Le backend est-il lancé ?'];
    const message: unknown = error.error?.message;
    if (Array.isArray(message)) return message.map(String);
    if (typeof message === 'string') return [message];
  }
  return ['Une erreur est survenue. Réessaie dans un instant.'];
}

// N'autorise que les chemins internes (évite les redirections vers un autre site)
export function safeRedirect(target: string | null): string {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
}