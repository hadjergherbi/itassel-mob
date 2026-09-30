/**
 * SuiviController + SuiviComplementController
 *
 * Le jeton_session reste EN MÉMOIRE uniquement (jamais SecureStore),
 * et est lié à une référence précise.
 */
import { api } from './client';

let sessionToken: string | null = null;
let sessionReference: string | null = null;
let sessionExpiresAt = 0;

function normalizeRef(reference: string): string {
  return reference.trim().toUpperCase();
}

export function setSuiviSession(
  reference: string,
  token: string,
  expireDansMin: number,
): void {
  sessionReference = normalizeRef(reference);
  sessionToken = token;
  sessionExpiresAt = Date.now() + expireDansMin * 60 * 1000;
}

/** Renvoie le jeton seulement si la référence correspond et la session est valide. */
export function getSuiviSession(reference: string): string | null {
  if (!sessionToken || !sessionReference) {
    return null;
  }
  if (normalizeRef(reference) !== sessionReference) {
    return null;
  }
  if (Date.now() > sessionExpiresAt) {
    clearSuiviSession();
    return null;
  }
  return sessionToken;
}

/** Secondes restantes pour la session liée à cette référence (0 si absente/expirée). */
export function getSuiviSessionRemainingSeconds(reference: string): number {
  if (!getSuiviSession(reference)) {
    return 0;
  }
  return Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000));
}

export function clearSuiviSession(): void {
  sessionToken = null;
  sessionReference = null;
  sessionExpiresAt = 0;
}

export type DemanderCodeResponse = {
  message: string;
};

export type VerifierCodeResponse = {
  jeton_session: string;
  expire_dans_min: number;
};

export type StatutInfo = {
  id_statut: number;
  code: string;
  libelle: string;
  couleur?: string | null;
};

export type HistoriqueItem = {
  id_evenement: number;
  date_evenement: string;
  type_evenement: string;
  detail?: string | null;
  visible_demandeur?: boolean;
  id_statut_avant?: number | null;
  id_statut_apres?: number | null;
  statut_apres?: StatutInfo | null;
};

export type ComplementItem = {
  id_complement: number;
  question?: string | null;
  piece_exigee: boolean;
  description_piece?: string | null;
  reponse?: string | null;
  date_demande?: string | null;
  date_reponse?: string | null;
  etat: string;
  id_doleance?: number;
};

export type ReponseItem = {
  id_reponse: number;
  contenu: string;
  date_publication?: string | null;
  id_doleance?: number;
  id_auteur?: number | null;
};

export type ServiceInfo = {
  id_service: number;
  nom_service: string;
};

export type DossierResponse = {
  id_doleance: number;
  reference: string;
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  wilaya: string;
  objet: string;
  description: string;
  date_depot: string;
  id_service?: number;
  id_statut?: number;
  id_nature?: number;
  id_qualite?: number;
  organisme_competent?: string | null;
  statut?: StatutInfo | null;
  service?: ServiceInfo | null;
  historique?: HistoriqueItem[];
  complements?: ComplementItem[];
  reponses?: ReponseItem[];
};

export async function demanderCode(reference: string): Promise<DemanderCodeResponse> {
  const { data } = await api.post<DemanderCodeResponse>('/suivi/demander-code', {
    reference: normalizeRef(reference),
  });
  return data;
}

export async function verifierCode(
  reference: string,
  code: string,
): Promise<VerifierCodeResponse> {
  const ref = normalizeRef(reference);
  const { data } = await api.post<VerifierCodeResponse>('/suivi/verifier-code', {
    reference: ref,
    code,
  });
  setSuiviSession(ref, data.jeton_session, data.expire_dans_min);
  return data;
}

export async function fetchDossier(reference: string): Promise<DossierResponse> {
  const token = getSuiviSession(reference);
  if (!token) {
    throw new Error('NO_SESSION');
  }
  const { data } = await api.get<DossierResponse>('/suivi/dossier', {
    headers: { 'X-Suivi-Token': token },
  });
  return data;
}

export type AttachmentFile = {
  uri: string;
  name: string;
  mimeType: string;
};

export async function repondreComplement(
  reference: string,
  message: string,
  piece: AttachmentFile | null,
): Promise<{ message: string }> {
  const token = getSuiviSession(reference);
  if (!token) {
    throw new Error('NO_SESSION');
  }

  const form = new FormData();
  form.append('message', message);

  if (piece) {
    form.append('piece_jointe', {
      uri: piece.uri,
      name: piece.name,
      type: piece.mimeType,
    } as unknown as Blob);
  }

  const { data } = await api.post<{ message: string }>('/suivi/repondre-complement', form, {
    headers: {
      'X-Suivi-Token': token,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}
