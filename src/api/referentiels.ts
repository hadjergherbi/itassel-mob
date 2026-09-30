/**
 * GET /api/referentiels — ReferentielController@index
 *
 * Forme EXACTE de la réponse JSON (pas d'enveloppe data) :
 * {
 *   "services": [ { "id_service": number, "nom_service": string } ],
 *   "natures":  [ { "id_nature": number, "libelle": string } ],
 *   "qualites": [ { "id_qualite": number, "libelle": string } ]
 * }
 *
 * Pas de wilayas. Cache mémoire pour la durée de la session.
 */
import { API_BASE_URL, api } from './client';

export type ServiceItem = {
  id_service: number;
  nom_service: string;
};

export type NatureItem = {
  id_nature: number;
  libelle: string;
};

export type QualiteItem = {
  id_qualite: number;
  libelle: string;
};

export type ReferentielsResponse = {
  services: ServiceItem[];
  natures: NatureItem[];
  qualites: QualiteItem[];
};

export type ReferentielsFetchResult = {
  data: ReferentielsResponse;
  url: string;
  status: number;
  fromCache: boolean;
};

let memoryCache: ReferentielsResponse | null = null;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Normalise la réponse brute du back sans inventer de champs. */
export function parseReferentielsResponse(raw: unknown): ReferentielsResponse {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const services: ServiceItem[] = [];
  asArray(body.services).forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const row = item as Record<string, unknown>;
    const id = toNumber(row.id_service);
    const nom = toText(row.nom_service);
    if (id !== null && nom) {
      services.push({ id_service: id, nom_service: nom });
    }
  });

  const natures: NatureItem[] = [];
  asArray(body.natures).forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const row = item as Record<string, unknown>;
    const id = toNumber(row.id_nature);
    const libelle = toText(row.libelle);
    if (id !== null && libelle) {
      natures.push({ id_nature: id, libelle });
    }
  });

  const qualites: QualiteItem[] = [];
  asArray(body.qualites).forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const row = item as Record<string, unknown>;
    const id = toNumber(row.id_qualite);
    const libelle = toText(row.libelle);
    if (id !== null && libelle) {
      qualites.push({ id_qualite: id, libelle });
    }
  });

  return { services, natures, qualites };
}

export function getReferentielsCache(): ReferentielsResponse | null {
  return memoryCache;
}

export function clearReferentielsCache(): void {
  memoryCache = null;
}

/**
 * Charge les référentiels (ou renvoie le cache mémoire).
 * @param force true pour ignorer le cache (bouton Réessayer)
 */
export async function fetchReferentiels(
  force: boolean = false,
): Promise<ReferentielsFetchResult> {
  const url = `${API_BASE_URL}/referentiels`;

  if (!force && memoryCache) {
    return {
      data: memoryCache,
      url,
      status: 200,
      fromCache: true,
    };
  }

  const response = await api.get<unknown>('/referentiels');
  const data = parseReferentielsResponse(response.data);
  memoryCache = data;

  return {
    data,
    url,
    status: response.status,
    fromCache: false,
  };
}
