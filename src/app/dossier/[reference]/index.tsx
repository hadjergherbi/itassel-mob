import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseApiError } from '@/api/client';
import { getReferentielsCache, fetchReferentiels } from '@/api/referentiels';
import {
  clearSuiviSession,
  fetchDossier,
  getSuiviSession,
  getSuiviSessionRemainingSeconds,
  type DossierResponse,
  type HistoriqueItem,
} from '@/api/suivi';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatutBadge } from '@/components/StatutBadge';
import { statusLabel, useLanguage } from '@/i18n/LanguageProvider';
import { traduireLibelleReferentiel } from '@/i18n/referentielLabels';
import type { Lang } from '@/i18n/fr';
import { useAppStorage } from '@/storage/AppStorageProvider';
import { colors, radius } from '@/theme';
import { localeFor } from '@/utils/dateLocale';

function formatDateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(localeFor(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(localeFor(lang), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString(localeFor(lang), {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

function lastVisibleDate(dossier: DossierResponse): string {
  const hist = dossier.historique ?? [];
  if (hist.length > 0) {
    const sorted = [...hist].sort(
      (a, b) =>
        new Date(b.date_evenement).getTime() - new Date(a.date_evenement).getTime(),
    );
    return sorted[0].date_evenement;
  }
  return dossier.date_depot;
}

function nextStepKey(code: string | undefined): string {
  switch (code) {
    case 'information_demandee':
      return 'dossier.nextComplement';
    case 'nouvelle':
      return 'dossier.nextNouvelle';
    case 'en_cours':
      return 'dossier.nextEnCours';
    case 'resolue':
      return 'dossier.nextResolue';
    case 'reponse_apportee':
      return 'dossier.nextReponse';
    case 'non_retenue':
      return 'dossier.nextNonRetenue';
    case 'hors_competence':
      return 'dossier.nextHorsCompetence';
    case 'double':
      return 'dossier.nextDouble';
    case 'cloturee':
      return 'dossier.nextCloturee';
    case 'non_fondee':
      return 'dossier.nextNonFondee';
    default:
      return 'dossier.nextDefault';
  }
}

function eventColor(type: string): string {
  if (type.includes('complement')) return colors.badge.information_demandee;
  if (type === 'reponse') return colors.badge.resolue;
  if (type === 'depot') return colors.badge.nouvelle;
  if (type.includes('statut')) return colors.badge.en_cours;
  return colors.institutional;
}

export default function DossierDetailScreen() {
  const params = useLocalSearchParams<{ reference: string }>();
  const reference = decodeURIComponent(String(params.reference ?? '')).toUpperCase();
  const { t, lang, isRTL } = useLanguage();
  const { syncStatutAndAlert, addDossier, updateDossierMeta } = useAppStorage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [dossier, setDossier] = useState<DossierResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [remainingSec, setRemainingSec] = useState(() =>
    getSuiviSessionRemainingSeconds(reference),
  );

  const pendingComplement = dossier?.complements?.find((c) => c.etat === 'en_attente');
  const needsComplement =
    dossier?.statut?.code === 'information_demandee' && Boolean(pendingComplement);

  const goVerify = useCallback(() => {
    clearSuiviSession();
    router.replace({
      pathname: '/suivi/verifier',
      params: { reference, locked: '1' },
    });
  }, [router, reference]);

  const loadDossier = useCallback(async () => {
    if (!getSuiviSession(reference)) {
      goVerify();
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (!getReferentielsCache()) {
        await fetchReferentiels(false).catch(() => null);
      }
      const data = await fetchDossier(reference);
      setDossier(data);
      const updatedAt = lastVisibleDate(data);
      if (data.statut?.code) {
        await syncStatutAndAlert(data.reference, data.statut.code);
      }
      await addDossier(data.reference);
      await updateDossierMeta(data.reference, {
        objet: data.objet,
        updatedAt,
      });
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.status === 401 || (err instanceof Error && err.message === 'NO_SESSION')) {
        goVerify();
        return;
      }
      setError(t(parsed.messageKey === 'errors.generic' ? 'dossier.loadError' : parsed.messageKey));
    } finally {
      setLoading(false);
    }
  }, [
    reference,
    syncStatutAndAlert,
    addDossier,
    updateDossierMeta,
    t,
    goVerify,
  ]);

  useFocusEffect(
    useCallback(() => {
      void loadDossier();
    }, [loadDossier]),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const left = getSuiviSessionRemainingSeconds(reference);
      setRemainingSec(left);
      if (left <= 0 && getSuiviSession(reference) === null) {
        goVerify();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [reference, goVerify]);

  const natureLabel = useMemo(() => {
    if (!dossier?.id_nature) {
      return '—';
    }
    const cache = getReferentielsCache();
    const nature = cache?.natures.find((n) => n.id_nature === dossier.id_nature);
    if (!nature) {
      return '—';
    }
    return traduireLibelleReferentiel('natures', nature.libelle, lang);
  }, [dossier?.id_nature, lang]);

  const historique = useMemo(() => {
    const items = dossier?.historique ?? [];
    return [...items].sort(
      (a, b) =>
        new Date(b.date_evenement).getTime() - new Date(a.date_evenement).getTime(),
    );
  }, [dossier?.historique]);

  function eventLabel(type: string): string {
    const key = `historyEvents.${type}`;
    const translated = t(key);
    if (translated === key) {
      return t('historyEvents.generic');
    }
    return translated;
  }

  const remainingMin = Math.max(1, Math.ceil(remainingSec / 60));

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { paddingTop: insets.top }, isRTL && styles.rowRtl]}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            size={24}
            color={colors.text}
          />
        </Pressable>
        <Text style={styles.topRef} numberOfLines={1} adjustsFontSizeToFit>
          {reference}
        </Text>
        <Pressable
          style={styles.iconBtn}
          onPress={() => void Share.share({ message: reference })}
          accessibilityRole="button"
          accessibilityLabel={t('dossier.share')}
          hitSlop={8}
        >
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {remainingSec > 0 ? (
        <View style={[styles.sessionBanner, isRTL && styles.rowRtl]}>
          <Ionicons name="shield-checkmark" size={16} color={colors.institutional} />
          <Text style={styles.sessionText}>
            {t('dossier.sessionSecure', { minutes: remainingMin })}
          </Text>
        </View>
      ) : null}

      {loading && !dossier ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.institutional} size="large" />
        </View>
      ) : error && !dossier ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, isRTL && styles.rtl]}>{error}</Text>
          <PrimaryButton label={t('common.retry')} onPress={() => void loadDossier()} />
        </View>
      ) : dossier ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ gap: 10 }}>
            <StatutBadge code={dossier.statut?.code} />
            <Text style={[styles.objet, isRTL && styles.rtl]}>{dossier.objet}</Text>
            <Text style={[styles.updated, isRTL && styles.rtl]}>
              {t('dossier.updatedAt', {
                date: formatDateTime(lastVisibleDate(dossier), lang),
              })}
            </Text>
          </Card>

          {needsComplement && pendingComplement ? (
            <Card style={styles.nextCard}>
              <Text style={[styles.nextEyebrow, isRTL && styles.rtl]}>
                {t('dossier.nextStep')}
              </Text>
              <Text style={[styles.nextTitle, isRTL && styles.rtl]}>
                {t('dossier.nextComplement')}
              </Text>
              {pendingComplement.question ? (
                <Text style={[styles.nextQuestion, isRTL && styles.rtl]}>
                  {t('dossier.nextQuestion', { question: pendingComplement.question })}
                </Text>
              ) : null}
              <PrimaryButton
                label={t('dossier.replyCta')}
                onPress={() =>
                  router.push({
                    pathname: '/dossier/[reference]/repondre',
                    params: { reference },
                  })
                }
                style={{ marginTop: 8 }}
              />
            </Card>
          ) : (
            <Card style={styles.nextCardNeutral}>
              <Text style={[styles.nextEyebrowMuted, isRTL && styles.rtl]}>
                {t('dossier.nextStep')}
              </Text>
              <Text style={[styles.nextTitle, isRTL && styles.rtl]}>
                {t(nextStepKey(dossier.statut?.code))}
              </Text>
            </Card>
          )}

          <Card style={{ paddingVertical: 4, gap: 0 }}>
            <InfoRow label={t('dossier.nature')} value={natureLabel} rtl={isRTL} />
            <InfoRow
              label={t('dossier.domain')}
              value={
                dossier.service?.nom_service
                  ? traduireLibelleReferentiel(
                      'services',
                      dossier.service.nom_service,
                      lang,
                    )
                  : '—'
              }
              rtl={isRTL}
            />
            <InfoRow
              label={t('dossier.depositedAt')}
              value={formatDateShort(dossier.date_depot, lang)}
              rtl={isRTL}
            />
            <InfoRow label={t('dossier.wilaya')} value={dossier.wilaya || '—'} rtl={isRTL} last />
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
              {t('dossier.response')}
            </Text>
            {(dossier.reponses ?? []).length === 0 ? (
              <Text style={[styles.muted, isRTL && styles.rtl]}>{t('dossier.noResponse')}</Text>
            ) : (
              (dossier.reponses ?? []).map((rep) => (
                <View key={rep.id_reponse} style={{ gap: 4 }}>
                  <Text style={[styles.responseBody, isRTL && styles.rtl]}>{rep.contenu}</Text>
                  {rep.date_publication ? (
                    <Text style={[styles.muted, isRTL && styles.rtl]}>
                      {formatDateTime(rep.date_publication, lang)}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </Card>

          <Card style={{ gap: 12 }}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
              {t('dossier.history')}
            </Text>
            {historique.length === 0 ? (
              <Text style={[styles.muted, isRTL && styles.rtl]}>{t('dossier.noHistory')}</Text>
            ) : (
              historique.map((item, index) => (
                <HistoryRow
                  key={item.id_evenement}
                  item={item}
                  last={index === historique.length - 1}
                  rtl={isRTL}
                  lang={lang}
                  title={eventLabel(item.type_evenement)}
                  statusText={
                    item.statut_apres?.code
                      ? statusLabel(t, item.statut_apres.code)
                      : null
                  }
                />
              ))
            )}
          </Card>
        </ScrollView>
      ) : null}
    </View>
  );
}

function InfoRow(props: {
  label: string;
  value: string;
  rtl: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        props.rtl && styles.rowRtl,
        !props.last && styles.infoBorder,
      ]}
    >
      <Text style={[styles.infoLabel, props.rtl && styles.rtl]}>{props.label}</Text>
      <Text
        style={[styles.infoValue, props.rtl ? styles.infoValueRtl : null]}
        numberOfLines={2}
      >
        {props.value}
      </Text>
    </View>
  );
}

function HistoryRow(props: {
  item: HistoriqueItem;
  last: boolean;
  rtl: boolean;
  lang: Lang;
  title: string;
  statusText: string | null;
}) {
  const color = eventColor(props.item.type_evenement);
  return (
    <View style={[styles.histRow, props.rtl && styles.rowRtl]}>
      <View style={styles.timeline}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        {!props.last ? <View style={styles.line} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2, paddingBottom: props.last ? 0 : 14 }}>
        <Text style={[styles.histTitle, props.rtl && styles.rtl]}>
          {props.statusText ? `${props.title} · ${props.statusText}` : props.title}
        </Text>
        <Text style={[styles.histDate, props.rtl && styles.rtl]}>
          {formatDateTime(props.item.date_evenement, props.lang)}
        </Text>
        {props.item.detail ? (
          <Text style={[styles.histDetail, props.rtl && styles.rtl]}>{props.item.detail}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    minHeight: 48,
  },
  iconBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRef: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  sessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sessionText: {
    color: colors.institutional,
    fontSize: 13,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 15,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  objet: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  updated: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  nextCard: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    gap: 8,
  },
  nextCardNeutral: {
    gap: 6,
  },
  nextEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.badge.information_demandee,
    letterSpacing: 0.6,
  },
  nextEyebrowMuted: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  nextTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  nextQuestion: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  infoBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lightGray,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  infoValue: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  infoValueRtl: {
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  responseBody: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  histRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeline: {
    width: 16,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.lightGray,
    marginTop: 4,
  },
  histTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  histDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  histDetail: {
    fontSize: 13,
    color: colors.textSecondary,
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
