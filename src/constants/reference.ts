/** Référence ITS : année + 4 à 6 chiffres (le back passera à 6). */
export const REFERENCE_REGEX = /^ITS-\d{4}-\d{4,6}$/i;

export function isValidReference(value: string): boolean {
  return REFERENCE_REGEX.test(value.trim());
}
