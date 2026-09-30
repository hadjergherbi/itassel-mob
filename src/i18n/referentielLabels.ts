import type { Lang } from '@/i18n/fr';

/**
 * Libellés FR renvoyés par GET /referentiels → traduction app (repli = français).
 * Clés = libellés exacts du back (nom_service / libelle).
 */
const TABLES: Record<
  'services' | 'natures' | 'qualites',
  Record<Lang, Record<string, string>>
> = {
  services: {
    fr: {},
    en: {
      Sport: 'Sport',
      Jeunesse: 'Youth',
      'Ressources humaines': 'Human resources',
    },
    ar: {
      Sport: 'الرياضة',
      Jeunesse: 'الشباب',
      'Ressources humaines': 'الموارد البشرية',
    },
  },
  natures: {
    fr: {},
    en: {
      Réclamation: 'Complaint',
      Signalement: 'Report',
      Suggestion: 'Suggestion',
      "Demande d'information": 'Information request',
    },
    ar: {
      Réclamation: 'شكوى',
      Signalement: 'إبلاغ',
      Suggestion: 'اقتراح',
      "Demande d'information": 'طلب معلومات',
    },
  },
  qualites: {
    fr: {},
    en: {
      association: 'association',
      'entreprise ou institution': 'company or institution',
      athlète: 'athlete',
      'jeune homme / jeune femme': 'young man / young woman',
      'Employé dans le secteur': 'Employee in the sector',
      djalia: 'diaspora',
    },
    ar: {
      association: 'جمعية',
      'entreprise ou institution': 'مؤسسة أو هيئة',
      athlète: 'رياضي',
      'jeune homme / jeune femme': 'شاب / شابة',
      'Employé dans le secteur': 'موظف في القطاع',
      djalia: 'الجالية',
    },
  },
};

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function traduireLibelleReferentiel(
  type: 'services' | 'natures' | 'qualites',
  libelleFr: string,
  lang: Lang,
): string {
  const source = libelleFr.trim();
  if (!source || lang === 'fr') {
    return source;
  }

  const table = TABLES[type][lang];
  if (table[source]) {
    return table[source];
  }

  const cible = normaliser(source);
  const match = Object.keys(table).find((cle) => normaliser(cle) === cible);
  if (match) {
    return table[match];
  }

  // Repli : libellé français du back
  return source;
}
