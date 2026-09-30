import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { Lang } from '@/i18n/fr';
import { routes } from '@/navigation/routes';
import { colors, radius } from '@/theme';

const OPTIONS: { lang: Lang; labelKey: string; codeKey: string }[] = [
  { lang: 'fr', labelKey: 'langFr', codeKey: 'codeFr' },
  { lang: 'en', labelKey: 'langEn', codeKey: 'codeEn' },
  { lang: 'ar', labelKey: 'langAr', codeKey: 'codeAr' },
];

export default function LangueScreen() {
  const { t, lang, confirmLanguage, isRTL, hasChosenLanguage } = useLanguage();
  const [selected, setSelected] = useState<Lang>(lang);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function onStart() {
    setLoading(true);
    const reloading = await confirmLanguage(selected);
    setLoading(false);
    if (!reloading) {
      router.replace(routes.tabs);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={styles.brand}>{t('brand')}</Text>
        <Text style={[styles.tagline, isRTL && styles.rtl]}>{t('brandTagline')}</Text>

        <Text style={[styles.choose, isRTL && styles.rtl]}>{t('chooseLanguage')}</Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const active = selected === option.lang;
            return (
              <Pressable
                key={option.lang}
                onPress={() => setSelected(option.lang)}
                style={[
                  styles.option,
                  active && styles.optionActive,
                  isRTL && styles.rowRtl,
                ]}
              >
                <Text style={[styles.optionLabel, isRTL && styles.rtl]}>
                  {t(option.labelKey)}
                </Text>
                <View style={[styles.optionRight, isRTL && styles.rowRtl]}>
                  <Text style={styles.optionCode}>{t(option.codeKey)}</Text>
                  {active ? (
                    <Ionicons name="checkmark" size={20} color={colors.white} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.reassure}>
          <ReassureRow icon="shield-checkmark-outline" text={t('reassureOfficial')} rtl={isRTL} />
          <ReassureRow icon="lock-closed-outline" text={t('reassureConfidential')} rtl={isRTL} />
          <ReassureRow icon="mail-outline" text={t('reassureSecure')} rtl={isRTL} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={`${t('start')} ${isRTL ? '←' : '→'}`}
          variant="welcome"
          loading={loading}
          onPress={() => void onStart()}
        />
        {hasChosenLanguage ? (
          <PrimaryButton
            label={t('common.cancel')}
            variant="outline"
            onPress={() => router.back()}
            style={{ marginTop: 10, borderColor: colors.white }}
          />
        ) : null}
        <Text style={[styles.privacy, isRTL && styles.rtl]}>{t('privacyNote')}</Text>
      </View>
    </View>
  );
}

function ReassureRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  rtl: boolean;
}) {
  return (
    <View style={[styles.reassureRow, props.rtl && styles.rowRtl]}>
      <Ionicons name={props.icon} size={18} color={colors.white} />
      <Text style={[styles.reassureText, props.rtl && styles.rtl]}>{props.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.welcome,
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 16,
    backgroundColor: colors.white,
  },
  brand: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tagline: {
    color: colors.white,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  choose: {
    alignSelf: 'stretch',
    color: colors.white,
    opacity: 0.85,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  options: {
    alignSelf: 'stretch',
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionActive: {
    borderColor: colors.white,
  },
  optionLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionCode: {
    color: colors.white,
    fontWeight: '700',
  },
  reassure: {
    alignSelf: 'stretch',
    marginTop: 28,
    gap: 12,
  },
  reassureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reassureText: {
    color: colors.white,
    fontSize: 14,
  },
  footer: {
    gap: 12,
  },
  privacy: {
    color: colors.white,
    opacity: 0.75,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
