import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './models';

export type Slot = 'cpu' | 'motherboard' | 'ram' | 'gpu' | 'storage' | 'psu' | 'case';

export interface ConfiguratorPart {
  id: number;
  slot: Slot;
  name: string;
  slug: string;
  brand: string;
  price: number;
  stockQuantity: number;
  image: { url: string; altText: string | null } | null;
  highlights: string[];
  // Caractéristiques techniques (selon l'emplacement) — utilisées aussi par la vue 3D
  cpu?: { socket: string; cores: number; tdpWatts: number; hasIntegratedGraphics: boolean };
  motherboard?: { socket: string; chipset: string; ramType: string; ramSlots: number; maxRamGB: number; formFactor: FormFactor };
  ram?: { type: string; modules: number; capacityGB: number; speedMHz: number };
  gpu?: { chipset: string; vramGB: number; tdpWatts: number; lengthMm: number };
  psu?: { wattage: number; formFactor: string; efficiency: string };
  pcCase?: { supportedFormFactors: FormFactor[]; sfxOnly: boolean };
}

export type FormFactor = 'ATX' | 'MICRO_ATX' | 'MINI_ITX' | 'E_ATX';

export interface CompatibilityCheck {
  id: string;
  status: 'ok' | 'error' | 'warning' | 'pending';
  message: string;
  slots: Slot[];
}

export interface BuildCheck {
  parts: ConfiguratorPart[];
  checks: CompatibilityCheck[];
  valid: boolean;
  complete: boolean;
  estimatedWatts: number;
  recommendedPsuWatts: number;
  totalPrice: number;
}

export interface SavedConfiguration extends BuildCheck {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  unavailable: number;
}

export interface ConfigurationSummary {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  totalPrice: number;
  unavailableCount: number;
  images: string[];
}

@Injectable({ providedIn: 'root' })
export class ConfiguratorApi {
  private http = inject(HttpClient);

  /** Composants en stock compatibles avec `selectedIds` pour l'emplacement demandé. */
  parts(slot: Slot, selectedIds: number[]) {
    const params: Record<string, string> = { slot };
    if (selectedIds.length) params['ids'] = selectedIds.join(',');
    return this.http.get<{ slot: Slot; items: ConfiguratorPart[]; hidden: number }>(`${API_URL}/configurator/parts`, { params });
  }

  check(ids: number[]) {
    return this.http.get<BuildCheck>(`${API_URL}/configurator/check`, { params: { ids: ids.join(',') } });
  }

  list() {
    return this.http.get<ConfigurationSummary[]>(`${API_URL}/configurations`);
  }

  get(id: number) {
    return this.http.get<SavedConfiguration>(`${API_URL}/configurations/${id}`);
  }

  create(name: string, productIds: number[]) {
    return this.http.post<SavedConfiguration>(`${API_URL}/configurations`, { name, productIds });
  }

  update(id: number, name: string, productIds: number[]) {
    return this.http.patch<SavedConfiguration>(`${API_URL}/configurations/${id}`, { name, productIds });
  }

  delete(id: number) {
    return this.http.delete<{ deleted: boolean }>(`${API_URL}/configurations/${id}`);
  }
}
