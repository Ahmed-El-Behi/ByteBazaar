import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_URL, AuthResponse, AuthUser, RegisterInput } from './models';
import { readToken, writeToken } from './token-storage';

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