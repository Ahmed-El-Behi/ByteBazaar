import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';
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

  // Requête /auth/me en cours (partagée entre les appelants)
  private pendingUser: Observable<AuthUser | null> | null = null;

  constructor() {
    if (this.tokenSignal()) this.ensureUser().subscribe();
  }

  ensureUser(): Observable<AuthUser | null> {
    if (this.user() || !this.tokenSignal()) return of(this.user());
    this.pendingUser ??= this.http.get<AuthUser>(`${API_URL}/auth/me`).pipe(
      tap((user) => this.user.set(user)),
      catchError((error) => {
        // Token expiré ou invalide : on déconnecte. Une panne réseau ne déconnecte pas.
        if (error.status === 401) this.clear();
        return of(null);
      }),
      finalize(() => (this.pendingUser = null)),
      shareReplay(1),
    );
    return this.pendingUser;
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

  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/reset-password`, {
      token,
      newPassword,
    });
  }

  updateProfile(data: UpdateProfileInput) {
    return this.http.patch<AuthUser>(`${API_URL}/auth/profile`, data).pipe(
      tap((updatedUser) => {
        this.user.set(updatedUser);
      }),
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
}
