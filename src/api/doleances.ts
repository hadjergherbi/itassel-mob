/**
 * DoleanceController
 *
 * GET  /api/formulaire/jeton  → { jeton }
 * POST /api/doleances
 *
 * Corps validé (store) :
 *   nom, prenom, email, telephone, wilaya, objet, description,
 *   id_service, id_nature, id_qualite
 * Anti-spam (non persistés) :
 *   site_web (honeypot, doit rester vide),
 *   jeton_formulaire (valeur de GET /formulaire/jeton → champ "jeton")
 * Interdit :
 *   piece_jointe (prohibited au dépôt)
 *
 * Succès 201 : { reference, message }
 * Spam 422   : { message }
 */
import { api } from './client';

/** Réponse GET /formulaire/jeton */
export type JetonResponse = {
  jeton: string;
};

/** Corps POST /doleances — noms exacts du back */
export type DepotPayload = {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  wilaya: string;
  objet: string;
  description: string;
  id_service: number;
  id_nature: number;
  id_qualite: number;
  /** Valeur reçue dans { jeton } — renvoyée sous ce nom */
  jeton_formulaire: string;
  /** Honeypot : toujours "" */
  site_web: string;
};

export type DepotSuccess = {
  reference: string;
  message: string;
};

let cachedJeton: string | null = null;
let jetonObtainedAt = 0;

export async function fetchFormulaireJeton(): Promise<string> {
  const { data } = await api.get<JetonResponse>('/formulaire/jeton');
  cachedJeton = data.jeton;
  jetonObtainedAt = Date.now();
  return data.jeton;
}

export function getJetonAgeSeconds(): number {
  if (!cachedJeton || !jetonObtainedAt) {
    return Number.POSITIVE_INFINITY;
  }
  return (Date.now() - jetonObtainedAt) / 1000;
}

export function getCachedJeton(): string | null {
  return cachedJeton;
}

/** Renouvelle si absent ou > 2 h (formulaire_delai_max = 7200). */
export async function ensureFreshJeton(): Promise<string> {
  const age = getJetonAgeSeconds();
  if (!cachedJeton || age > 7200) {
    return fetchFormulaireJeton();
  }
  return cachedJeton;
}

/** Attend le délai mini anti-spam (formulaire_delai_min = 3 s). */
export async function waitMinAntiSpam(): Promise<void> {
  const ageMs = Date.now() - jetonObtainedAt;
  const remaining = 3000 - ageMs;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

export async function createDoleance(payload: DepotPayload): Promise<DepotSuccess> {
  const { data } = await api.post<DepotSuccess>('/doleances', payload);
  return data;
}
