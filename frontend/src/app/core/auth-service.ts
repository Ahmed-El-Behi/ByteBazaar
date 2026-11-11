import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_URL, AuthResponse, AuthUser, RegisterInput } from './models';
import { readToken, writeToken } from './token-storage';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  currentPassword?: string;
  newPassword?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly tokenSignal = signal<string | null>(readToken());

  readonly user = signal<AuthUser | null>(null);
  readonly isLoggedIn = computed(() => this.tokenSignal() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  constructor() {
    // Au rechargement de la page, on récupère le profil si un token existe
    if (this.tokenSignal()) this.refresh();
  }

  register(data: RegisterInput) {
    return this.http
      .post<AuthResponse>(`${API_URL}/auth/register`, data)
      .pipe(tap((res) => this.setSession(res)));
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>(`${API_URL}/auth/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  // Demande d'envoi du mail de réinitialisation de mot de passe
  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/forgot-password`, { email });
  }

  // Validation du nouveau mot de passe via le token reçu par mail
  resetPassword(token: string, newPassword: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/reset-password`, {
      token,
      newPassword,
    });
  }

  // Mise à jour du profil et persistance PostgreSQL/Prisma
  updateProfile(data: UpdateProfileInput) {
    return this.http
      .patch<AuthUser>(`${API_URL}/auth/profile`, data)
      .pipe(
        tap((updatedUser) => {
          // Met à jour le signal réactif user pour refléter immédiatement le prénom, nom, téléphone
          this.user.set(updatedUser);
        })
      );
  }

  logout() {
    this.clear();
    this.router.navigateByUrl('/');
  }

  private setSession(res: AuthResponse) {
    writeToken(res.accessToken);
    this.tokenSignal.set(res.accessToken);
    this.user.set(res.user);
  }

  private clear() {
    writeToken(null);
    this.tokenSignal.set(null);
    this.user.set(null);
  }

  private refresh() {
    this.http.get<AuthUser>(`${API_URL}/auth/me`).subscribe({
      next: (user) => this.user.set(user),
      error: (error) => {
        // Token expiré ou invalide : on déconnecte. Une panne réseau ne déconnecte pas.
        if (error.status === 401) this.clear();
      },
    });
  }
}