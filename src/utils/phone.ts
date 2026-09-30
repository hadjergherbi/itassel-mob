/** Téléphone algérien — mêmes règles que DoleanceController. */
export const PHONE_RE = /^(\+213|0)([5-7]\d{8}|[2-4]\d{7,8})$/;

/** Retire espaces et 0 initial du numéro local saisi. */
export function normalizeLocalPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

/** Construit la valeur envoyée au back : +213XXXXXXXXX */
export function toApiPhone(localRaw: string): string {
  return `+213${normalizeLocalPhone(localRaw)}`;
}

export function isValidAlgerianPhone(apiOrLocal: string): boolean {
  const cleaned = apiOrLocal.replace(/\s+/g, '');
  if (PHONE_RE.test(cleaned)) {
    return true;
  }
  return PHONE_RE.test(toApiPhone(cleaned));
}

/** Affichage lisible : +213 555 00 00 00 (une ligne). */
export function formatPhoneDisplay(localRaw: string): string {
  const digits = normalizeLocalPhone(localRaw);
  if (!digits) {
    return '+213';
  }
  const parts: string[] = [];
  let i = 0;
  while (i < digits.length) {
    const size = i === 0 ? 3 : 2;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  return `+213 ${parts.join(' ')}`.trim();
}

/** Formate la saisie locale avec espaces (555 00 00 00). */
export function formatLocalInput(raw: string): string {
  const digits = normalizeLocalPhone(raw).slice(0, 9);
  const parts: string[] = [];
  let i = 0;
  while (i < digits.length) {
    const size = i === 0 ? 3 : 2;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  return parts.join(' ');
}
