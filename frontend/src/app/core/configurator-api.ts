import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { I18nService } from './i18n';
import { API_URL, type ProductListItem } from './models';

type PartsResponse = { slot: Slot; items: ConfiguratorPart[]; hidden: number };

export type PcSlot = 'cpu' | 'cooler' | 'motherboard' | 'ram' | 'gpu' | 'storage' | 'psu' | 'case';
export type DeskSlot = 'monitor' | 'keyboard' | 'mouse' | 'headset';
export type Slot = PcSlot | DeskSlot;
export const PC_SLOTS: PcSlot[] = [
  'cpu',
  'cooler',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case',
];
export const DESK_SLOTS: DeskSlot[] = ['monitor', 'keyboard', 'mouse', 'headset'];

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
  motherboard?: {
    socket: string;
    chipset: string;
    ramType: string;
    ramSlots: number;
    maxRamGB: number;
    formFactor: FormFactor;
  };
  ram?: { type: string; modules: number; capacityGB: number; speedMHz: number };
  gpu?: { chipset: string; vramGB: number; tdpWatts: number; lengthMm: number };
  psu?: { wattage: number; formFactor: string; efficiency: string };
  pcCase?: { supportedFormFactors: FormFactor[]; sfxOnly: boolean };
  cooler?: { liquid: boolean; radiatorMm: number | null };
  monitor?: {
    screenSizeIn: number;
    resolutionWidth: number;
    resolutionHeight: number;
    refreshRateHz: number;
    panelType: string | null;
  };
  keyboard?: {
    wireless: boolean;
    tenkeyless: boolean;
    style: string | null;
    switches: string | null;
    backlight: string | null;
  };
  mouse?: { wireless: boolean; maxDpi: number | null };
  headset?: { wireless: boolean; microphone: boolean; type: string | null };
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
  private i18n = inject(I18nService);
  /** Listes déjà chargées pendant la visite : rouvrir un sélecteur est immédiat */
  private readonly partsCache = new Map<string, Observable<PartsResponse>>();

  /** Composants en stock compatibles avec `selectedIds` pour l'emplacement demandé. */
  parts(slot: Slot, selectedIds: number[]) {
    const ids = [...selectedIds].sort((a, b) => a - b);
    // Les points forts des pièces sont traduits par le serveur : une liste par langue
    const key = `${slot}|${ids.join(',')}|${this.i18n.lang()}`;
    let request = this.partsCache.get(key);
    if (!request) {
      const params: Record<string, string> = { slot };
      if (ids.length) params['ids'] = ids.join(',');
      request = this.http.get<PartsResponse>(`${API_URL}/configurator/parts`, { params }).pipe(
        catchError((error) => {
          this.partsCache.delete(key); // échec : la prochaine ouverture réessaie
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.partsCache.set(key, request);
    }
    return request;
  }

  suggestions(productId: number) {
    return this.http.get<ProductListItem[]>(`${API_URL}/configurator/suggestions`, {
      params: { productId },
    });
  }

  check(ids: number[]) {
    return this.http.get<BuildCheck>(`${API_URL}/configurator/check`, {
      params: { ids: ids.join(',') },
    });
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
    return this.http.patch<SavedConfiguration>(`${API_URL}/configurations/${id}`, {
      name,
      productIds,
    });
  }

  delete(id: number) {
    return this.http.delete<{ deleted: boolean }>(`${API_URL}/configurations/${id}`);
  }
}
