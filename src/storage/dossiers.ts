import * as SecureStore from 'expo-secure-store';

const KEY = 'itassel_references';

export type StoredDossier = {
  reference: string;
  lastStatut: string | null;
  /** Objet connu après dépôt ou ouverture du dossier — jamais avant. */
  objet: string | null;
  updatedAt: string;
};

async function readAll(): Promise<StoredDossier[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as StoredDossier[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => ({
      reference: item.reference,
      lastStatut: item.lastStatut ?? null,
      objet: item.objet ?? null,
      updatedAt: item.updatedAt,
    }));
  } catch {
    return [];
  }
}

async function writeAll(items: StoredDossier[]): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(items));
}

export async function listReferences(): Promise<StoredDossier[]> {
  const items = await readAll();
  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/**
 * Ajoute / touche une référence.
 * Ne modifie PAS lastStatut ni objet d'une entrée existante
 * (réservé à updateReferenceStatut / updateDossierMeta).
 */
export async function addReference(
  reference: string,
  lastStatut: string | null = null,
  objet: string | null = null,
): Promise<void> {
  const normalized = reference.trim().toUpperCase();
  const items = await readAll();
  const existing = items.find((item) => item.reference === normalized);
  if (existing) {
    existing.updatedAt = new Date().toISOString();
    if (objet && !existing.objet) {
      existing.objet = objet;
    }
    if (lastStatut && existing.lastStatut === null) {
      existing.lastStatut = lastStatut;
    }
  } else {
    items.unshift({
      reference: normalized,
      lastStatut,
      objet,
      updatedAt: new Date().toISOString(),
    });
  }
  await writeAll(items);
}

/**
 * Met à jour le statut connu et renvoie l'ancien (null si première fois).
 * previous === null → pas d'alerte de statut (premier chargement).
 */
export async function updateReferenceStatut(
  reference: string,
  lastStatut: string,
): Promise<string | null> {
  const normalized = reference.trim().toUpperCase();
  const items = await readAll();
  const existing = items.find((item) => item.reference === normalized);
  const previous = existing?.lastStatut ?? null;
  if (existing) {
    existing.lastStatut = lastStatut;
    existing.updatedAt = new Date().toISOString();
  } else {
    items.unshift({
      reference: normalized,
      lastStatut,
      objet: null,
      updatedAt: new Date().toISOString(),
    });
  }
  await writeAll(items);
  return previous;
}

/** Met à jour objet / date après chargement dossier ou dépôt (sans toucher lastStatut). */
export async function updateDossierMeta(
  reference: string,
  meta: { objet?: string | null; updatedAt?: string },
): Promise<void> {
  const normalized = reference.trim().toUpperCase();
  const items = await readAll();
  const existing = items.find((item) => item.reference === normalized);
  if (!existing) {
    items.unshift({
      reference: normalized,
      lastStatut: null,
      objet: meta.objet ?? null,
      updatedAt: meta.updatedAt ?? new Date().toISOString(),
    });
  } else {
    if (meta.objet !== undefined) {
      existing.objet = meta.objet;
    }
    if (meta.updatedAt) {
      existing.updatedAt = meta.updatedAt;
    }
  }
  await writeAll(items);
}

export async function removeReference(reference: string): Promise<void> {
  const normalized = reference.trim().toUpperCase();
  const items = await readAll();
  await writeAll(items.filter((item) => item.reference !== normalized));
}

/** Statuts considérés « en cours » (sinon terminés ; inconnu = en cours). */
export const STATUTS_EN_COURS = new Set([
  'nouvelle',
  'en_cours',
  'information_demandee',
]);

export const STATUTS_TERMINES = new Set([
  'resolue',
  'reponse_apportee',
  'non_retenue',
  'hors_competence',
  'double',
  'cloturee',
  'non_fondee',
]);

export function isStatutTermine(code: string | null | undefined): boolean {
  if (!code) {
    return false;
  }
  return STATUTS_TERMINES.has(code);
}

export function isStatutEnCours(code: string | null | undefined): boolean {
  if (!code) {
    return true;
  }
  if (STATUTS_TERMINES.has(code)) {
    return false;
  }
  return true;
}
