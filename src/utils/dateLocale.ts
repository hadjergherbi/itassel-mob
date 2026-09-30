import type { Lang } from '@/i18n/fr';

export function localeFor(lang: Lang): string {
  if (lang === 'ar') return 'ar-DZ';
  if (lang === 'en') return 'en-GB';
  return 'fr-FR';
}

export function formatDateTime(date: Date, lang: Lang): string {
  return date.toLocaleString(localeFor(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
