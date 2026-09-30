/** Chemins de navigation de l'app. */
export const routes = {
  langue: '/langue',
  /** Groupe d'onglets — ouvre l'accueil (index). */
  tabs: '/(tabs)',
  deposer: '/(tabs)/deposer',
  dossiers: '/(tabs)/dossiers',
  alertes: '/(tabs)/alertes',
  suiviVerifier: '/suivi/verifier',
} as const;
