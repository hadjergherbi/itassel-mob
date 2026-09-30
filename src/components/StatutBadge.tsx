import { View, Text, StyleSheet } from 'react-native';

import { statusLabel, useLanguage } from '@/i18n/LanguageProvider';
import { colors, radius } from '@/theme';

const BADGE_COLORS: Record<string, string> = {
  nouvelle: colors.badge.nouvelle,
  en_cours: colors.badge.en_cours,
  information_demandee: colors.badge.information_demandee,
  resolue: colors.badge.resolue,
  reponse_apportee: colors.badge.reponse_apportee,
  non_retenue: colors.badge.non_retenue,
  hors_competence: colors.badge.hors_competence,
  double: colors.badge.double,
  cloturee: colors.badge.cloturee,
  non_fondee: colors.badge.non_fondee,
};

type Props = {
  code: string | null | undefined;
};

export function StatutBadge(props: Props) {
  const { t } = useLanguage();
  const code = props.code ?? 'nouvelle';
  const color = BADGE_COLORS[code] ?? colors.textSecondary;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{statusLabel(t, code)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.badge,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
