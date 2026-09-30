import * as SecureStore from 'expo-secure-store';
import type { Lang } from '@/i18n/fr';

const KEY = 'itassel_lang';

export async function getLanguage(): Promise<Lang | null> {
  const value = await SecureStore.getItemAsync(KEY);
  if (value === 'fr' || value === 'en' || value === 'ar') {
    return value;
  }
  return null;
}

export async function setLanguage(lang: Lang): Promise<void> {
  await SecureStore.setItemAsync(KEY, lang);
}
