import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  template: `
    <h1>ByteBazaar</h1>
    <p>Backend : {{ status() }}</p>
  `,
})
export class App {
  private http = inject(HttpClient);
  status = signal('chargement...');

  constructor() {
    this.http
      .get<{ status: string; database: string }>('http://localhost:3000/health')
      .subscribe({
        next: (r) => this.status.set(`${r.status} (base ${r.database})`),
        error: () => this.status.set('injoignable'),
      });
  }
}