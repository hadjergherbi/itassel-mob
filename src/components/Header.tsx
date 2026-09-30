import { Image, Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/i18n/LanguageProvider';
import { colors } from '@/theme';

type Props = {
  onLanguagePress: () => void;
  onAlertsPress: () => void;
  hasUnread: boolean;
};

export function Header(props: Props) {
  const { t, lang, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const langCode =
    lang === 'fr' ? t('codeFr') : lang === 'en' ? t('codeEn') : t('codeAr');

  return (
    <View style={[styles.row, { paddingTop: insets.top + 8 }, isRTL && styles.rowRtl]}>
      <View style={[styles.brand, isRTL && styles.rowRtl]}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <View>
          <Text style={[styles.title, isRTL && styles.rtlText]}>{t('brand')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
            {lang === 'ar' ? t('brandSubtitleAr') : t('brandSubtitle')}
          </Text>
        </View>
      </View>

      <View style={[styles.actions, isRTL && styles.rowRtl]}>
        <Pressable
          accessibilityRole="button"
          onPress={props.onLanguagePress}
          style={[styles.chip, isRTL && styles.rowRtl]}
        >
          <Ionicons name="globe-outline" size={16} color={colors.text} />
          <Text style={styles.chipText}>{langCode}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={props.onAlertsPress}
          style={styles.bellWrap}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {props.hasUnread ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  bellWrap: {
    padding: 4,
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
