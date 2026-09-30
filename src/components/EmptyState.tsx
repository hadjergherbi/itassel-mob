import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '@/i18n/LanguageProvider';
import { colors } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function EmptyState(props: Props) {
  const { isRTL } = useLanguage();

  return (
    <View style={styles.wrap}>
      <Ionicons
        name={props.icon ?? 'folder-open-outline'}
        size={40}
        color={colors.textSecondary}
      />
      <Text style={[styles.title, isRTL && styles.rtl]}>{props.title}</Text>
      {props.subtitle ? (
        <Text style={[styles.subtitle, isRTL && styles.rtl]}>{props.subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rtl: {
    writingDirection: 'rtl',
  },
});
