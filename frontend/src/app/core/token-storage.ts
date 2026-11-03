const KEY = 'bytebazaar_token';

export function readToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // stockage indisponible : on considère l'utilisateur déconnecté
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    // stockage indisponible : rien à faire
  }
}