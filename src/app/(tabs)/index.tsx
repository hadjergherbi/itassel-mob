import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getSuiviSession } from '@/api/suivi';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ReferenceInput } from '@/components/ReferenceInput';
import { StatutBadge } from '@/components/StatutBadge';
import { isValidReference } from '@/constants/reference';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useAppStorage } from '@/storage/AppStorageProvider';
import { colors, radius } from '@/theme';

function openSuivi(
  router: ReturnType<typeof useRouter>,
  reference: string,
  locked: boolean,
) {
  const ref = reference.trim().toUpperCase();
  if (getSuiviSession(ref)) {
    router.push({
      pathname: '/dossier/[reference]',
      params: { reference: ref },
    });
    return;
  }
  router.push({
    pathname: '/suivi/verifier',
    params: { reference: ref, locked: locked ? '1' : '0' },
  });
}

export default function AccueilScreen() {
  const { t, isRTL } = useLanguage();
  const { dossiers, unreadCount } = useAppStorage();
  const router = useRouter();
  const [reference, setReference] = useState('');
  const [refError, setRefError] = useState('');

  const recent = useMemo(() => dossiers.slice(0, 3), [dossiers]);

  function onTrack() {
    const value = reference.trim().toUpperCase();
    if (!isValidReference(value)) {
      setRefError(t('errors.invalidReference'));
      return;
    }
    setRefError('');
    openSuivi(router, value, false);
  }

  return (
    <View style={styles.screen}>
      <Header
        hasUnread={unreadCount > 0}
        onLanguagePress={() => router.push('/langue')}
        onAlertsPress={() => router.push('/(tabs)/alertes')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={[styles.heroEyebrow, isRTL && styles.rtl]}>{t('home.heroEyebrow')}</Text>
          <Text style={[styles.heroTitle, isRTL && styles.rtl]}>{t('home.heroTitle')}</Text>
          <Text style={[styles.heroSubtitle, isRTL && styles.rtl]}>{t('home.heroSubtitle')}</Text>
          <Pressable
            style={[styles.heroBtn, isRTL && styles.rowRtl]}
            onPress={() => router.push('/(tabs)/deposer')}
          >
            <Ionicons name="add" size={20} color={colors.institutional} />
            <Text style={styles.heroBtnText}>{t('home.ctaDeposit')}</Text>
          </Pressable>
        </View>

        <Card>
          <View style={[styles.trackHeader, isRTL && styles.rowRtl]}>
            <View style={styles.trackIcon}>
              <Ionicons name="search" size={18} color={colors.institutional} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trackTitle, isRTL && styles.rtl]}>{t('home.trackTitle')}</Text>
              <Text style={[styles.trackHelp, isRTL && styles.rtl]}>{t('home.trackHelp')}</Text>
            </View>
          </View>
          <ReferenceInput
            label={t('home.trackLabel')}
            placeholder={t('home.trackPlaceholder')}
            value={reference}
            onChangeText={setReference}
            error={refError}
          />
          <PrimaryButton
            label={t('home.trackSubmit')}
            variant="outline"
            onPress={onTrack}
            style={{ marginTop: 12 }}
          />
        </Card>

        <View style={[styles.sectionHeader, isRTL && styles.rowRtl]}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>{t('home.myDossiers')}</Text>
          <Pressable onPress={() => router.push('/(tabs)/dossiers')}>
            <Text style={styles.link}>{t('home.seeAll')}</Text>
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <Card>
            <EmptyState title={t('home.emptyDossiers')} />
          </Card>
        ) : (
          recent.map((item) => (
            <Pressable
              key={item.reference}
              onPress={() => openSuivi(router, item.reference, true)}
            >
              <Card style={styles.dossierCard}>
                <View style={[styles.dossierRow, isRTL && styles.rowRtl]}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={[styles.ref, isRTL && styles.rtl]}>{item.reference}</Text>
                    <StatutBadge code={item.lastStatut} />
                    {item.lastStatut === 'information_demandee' ? (
                      <Text style={[styles.action, isRTL && styles.rtl]}>
                        {t('home.actionRequired')}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
              </Card>
            </Pressable>
          ))
        )}

        <Text style={[styles.sectionTitle, isRTL && styles.rtl, { marginTop: 8 }]}>
          {t('home.howTitle')}
        </Text>
        <Card style={{ gap: 12 }}>
          <HowStep n="1" title={t('home.howStep1Title')} text={t('home.howStep1Text')} rtl={isRTL} />
          <HowStep n="2" title={t('home.howStep2Title')} text={t('home.howStep2Text')} rtl={isRTL} />
          <HowStep n="3" title={t('home.howStep3Title')} text={t('home.howStep3Text')} rtl={isRTL} />
        </Card>
      </ScrollView>
    </View>
  );
}

function HowStep(props: { n: string; title: string; text: string; rtl: boolean }) {
  return (
    <View style={[styles.howRow, props.rtl && styles.rowRtl]}>
      <View style={styles.howNum}>
        <Text style={styles.howNumText}>{props.n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.howTitle, props.rtl && styles.rtl]}>{props.title}</Text>
        <Text style={[styles.howText, props.rtl && styles.rtl]}>{props.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: colors.institutional,
    borderRadius: radius.card,
    padding: 20,
    gap: 10,
  },
  heroEyebrow: {
    color: colors.white,
    opacity: 0.85,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  heroSubtitle: {
    color: colors.white,
    opacity: 0.9,
    fontSize: 14,
    lineHeight: 20,
  },
  heroBtn: {
    marginTop: 8,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroBtnText: {
    color: colors.institutional,
    fontWeight: '700',
    fontSize: 15,
  },
  trackHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  trackIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  trackHelp: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  link: {
    color: colors.institutional,
    fontWeight: '700',
  },
  dossierCard: {
    marginBottom: 0,
  },
  dossierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ref: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.institutional,
  },
  action: {
    fontSize: 13,
    color: colors.text,
  },
  howRow: {
    flexDirection: 'row',
    gap: 12,
  },
  howNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumText: {
    color: colors.institutional,
    fontWeight: '800',
  },
  howTitle: {
    fontWeight: '700',
    color: colors.text,
  },
  howText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
