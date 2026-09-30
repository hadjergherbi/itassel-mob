/**
 * Brouillon du formulaire de dépôt — SecureStore uniquement.
 * Jamais journalisé. Expire après 24 h. Effacé après envoi réussi.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'itassel_deposit_draft_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

export type DepositDraftForm = {
  nom: string;
  prenom: string;
  email: string;
  telephoneLocal: string;
  wilaya: string;
  id_qualite: string;
  id_service: string;
  id_nature: string;
  objet: string;
  description: string;
  step: number;
};

type DraftEnvelope = {
  savedAt: number;
  form: DepositDraftForm;
};

export async function loadDepositDraft(): Promise<DepositDraftForm | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DraftEnvelope;
    if (!parsed?.savedAt || !parsed.form) {
      await clearDepositDraft();
      return null;
    }
    if (Date.now() - parsed.savedAt > TTL_MS) {
      await clearDepositDraft();
      return null;
    }
    return parsed.form;
  } catch {
    return null;
  }
}

export async function saveDepositDraft(form: DepositDraftForm): Promise<void> {
  const envelope: DraftEnvelope = {
    savedAt: Date.now(),
    form,
  };
  await SecureStore.setItemAsync(KEY, JSON.stringify(envelope));
}

export async function clearDepositDraft(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
