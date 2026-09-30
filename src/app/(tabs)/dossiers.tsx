import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

import { getSuiviSession } from '@/api/suivi';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ReferenceInput } from '@/components/ReferenceInput';
import { StatutBadge } from '@/components/StatutBadge';
import { isValidReference } from '@/constants/reference';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useAppStorage } from '@/storage/AppStorageProvider';
import {
  isStatutEnCours,
  isStatutTermine,
  type StoredDossier,
} from '@/storage/dossiers';
import { colors, radius } from '@/theme';
import { localeFor } from '@/utils/dateLocale';

type TabKey = 'all' | 'ongoing' | 'done';

function openSuivi(router: ReturnType<typeof useRouter>, reference: string) {
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
    params: { reference: ref, locked: '1' },
  });
}

function formatShortDate(iso: string, lang: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(localeFor(lang as 'fr' | 'en' | 'ar'), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function DossiersScreen() {
  const { t, lang, isRTL } = useLanguage();
  const { dossiers, addDossier, removeDossier, refresh } = useAppStorage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [newRef, setNewRef] = useState('');
  const [addError, setAddError] = useState('');

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const counts = useMemo(() => {
    let ongoing = 0;
    let done = 0;
    dossiers.forEach((d) => {
      if (isStatutTermine(d.lastStatut)) {
        done += 1;
      } else if (isStatutEnCours(d.lastStatut)) {
        ongoing += 1;
      }
    });
    return { all: dossiers.length, ongoing, done };
  }, [dossiers]);

  const filtered = useMemo(() => {
    if (tab === 'ongoing') {
      return dossiers.filter((d) => isStatutEnCours(d.lastStatut));
    }
    if (tab === 'done') {
      return dossiers.filter((d) => isStatutTermine(d.lastStatut));
    }
    return dossiers;
  }, [dossiers, tab]);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function confirmRemove(item: StoredDossier) {
    Alert.alert(t('dossiers.removeTitle'), t('dossiers.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('dossiers.removeConfirm'),
        style: 'destructive',
        onPress: () => void removeDossier(item.reference),
      },
    ]);
  }

  async function onAdd() {
    const value = newRef.trim().toUpperCase();
    if (!isValidReference(value)) {
      setAddError(t('errors.invalidReference'));
      return;
    }
    setAddVisible(false);
    setNewRef('');
    setAddError('');
    await addDossier(value, null, null);
    openSuivi(router, value);
  }

  function renderRightActions(item: StoredDossier) {
    return (
      <Pressable
        style={styles.swipeDelete}
        onPress={() => confirmRemove(item)}
        accessibilityRole="button"
        accessibilityLabel={t('dossiers.removeConfirm')}
      >
        <Ionicons name="trash-outline" size={22} color={colors.white} />
      </Pressable>
    );
  }

  return (
    <GestureHandlerRootView style={styles.screen}>
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.header, isRTL && styles.rowRtl]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, isRTL && styles.rtl]}>{t('dossiers.title')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtl]}>{t('dossiers.subtitle')}</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => setAddVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('dossiers.add')}
        >
          <Ionicons name="add" size={26} color={colors.institutional} />
        </Pressable>
      </View>

      <View style={[styles.tabs, isRTL && styles.rowRtl]}>
        {(
          [
            ['all', t('dossiers.tabAll', { count: counts.all })],
            ['ongoing', t('dossiers.tabOngoing', { count: counts.ongoing })],
            ['done', t('dossiers.tabDone', { count: counts.done })],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabOn]}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        {filtered.length === 0 ? (
          <Card>
            <EmptyState title={t('dossiers.empty')} subtitle={t('dossiers.emptyHint')} />
            <PrimaryButton
              label={t('dossiers.add')}
              onPress={() => setAddVisible(true)}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          filtered.map((item) => (
            <Swipeable
              key={item.reference}
              renderRightActions={isRTL ? undefined : () => renderRightActions(item)}
              renderLeftActions={isRTL ? () => renderRightActions(item) : undefined}
              overshootRight={false}
              overshootLeft={false}
            >
              <Pressable
                onPress={() => openSuivi(router, item.reference)}
                onLongPress={() => confirmRemove(item)}
                accessibilityRole="button"
              >
                <Card style={styles.item}>
                  <View style={[styles.itemTop, isRTL && styles.rowRtl]}>
                    <Text style={styles.ref} numberOfLines={1}>
                      {item.reference}
                    </Text>
                    <StatutBadge code={item.lastStatut} />
                  </View>
                  {item.objet ? (
                    <Text style={[styles.objet, isRTL && styles.rtl]} numberOfLines={2}>
                      {item.objet}
                    </Text>
                  ) : null}
                  <View style={[styles.itemBottom, isRTL && styles.rowRtl]}>
                    <Text style={[styles.dateLine, isRTL && styles.rtl, { flex: 1 }]} numberOfLines={1}>
                      {isStatutTermine(item.lastStatut)
                        ? t('dossiers.finishedOn', {
                            date: formatShortDate(item.updatedAt, lang),
                          })
                        : t('dossiers.updatedOn', {
                            date: formatShortDate(item.updatedAt, lang),
                          })}
                    </Text>
                    {item.lastStatut === 'information_demandee' ? (
                      <Text style={styles.actionRequired} numberOfLines={1}>
                        {t('dossiers.actionRequired')}
                      </Text>
                    ) : null}
                    <Ionicons
                      name={isRTL ? 'chevron-back' : 'chevron-forward'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </View>
                </Card>
              </Pressable>
            </Swipeable>
          ))
        )}

        <View style={[styles.hintBox, isRTL && styles.rowRtl]}>
          <Ionicons name="shield-checkmark" size={18} color={colors.institutional} />
          <Text style={[styles.hintText, isRTL && styles.rtl]}>{t('dossiers.listHint')}</Text>
        </View>
      </ScrollView>

      <Modal visible={addVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, isRTL && styles.rtl]}>{t('dossiers.addTitle')}</Text>
            <ReferenceInput
              label={t('home.trackLabel')}
              placeholder={t('home.trackPlaceholder')}
              value={newRef}
              onChangeText={setNewRef}
              error={addError}
            />
            <PrimaryButton label={t('dossiers.addSubmit')} onPress={() => void onAdd()} />
            <PrimaryButton
              label={t('common.cancel')}
              variant="outline"
              onPress={() => setAddVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: colors.lightGray,
    borderRadius: radius.input,
    padding: 4,
    gap: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabOn: {
    backgroundColor: colors.white,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextOn: {
    color: colors.text,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  item: {
    marginBottom: 0,
    gap: 8,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ref: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.institutional,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  objet: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLine: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionRequired: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.badge.information_demandee,
  },
  swipeDelete: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    marginBottom: 0,
    borderRadius: radius.card,
  },
  hintBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#E8F5EE',
    borderRadius: radius.card,
    padding: 14,
    marginTop: 8,
  },
  hintText: {
    flex: 1,
    color: colors.institutional,
    fontSize: 13,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
