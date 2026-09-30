import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { statusLabel, useLanguage } from '@/i18n/LanguageProvider';
import { useAppStorage } from '@/storage/AppStorageProvider';
import type { StoredAlert } from '@/storage/alerts';
import { colors } from '@/theme';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(iso: string, lang: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(date, now)) {
    return date.toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : lang === 'en' ? 'en-GB' : 'fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export default function AlertesScreen() {
  const { t, lang, isRTL } = useLanguage();
  const {
    alerts,
    markAllRead,
    markRead,
    notificationsEnabled,
    setNotifications,
  } = useAppStorage();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const groups = useMemo(() => {
    const today: StoredAlert[] = [];
    const week: StoredAlert[] = [];
    const older: StoredAlert[] = [];
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    alerts.forEach((alert) => {
      const created = new Date(alert.createdAt);
      if (isSameDay(created, now)) {
        today.push(alert);
      } else if (created >= weekStart) {
        week.push(alert);
      } else {
        older.push(alert);
      }
    });

    return { today, week, older };
  }, [alerts]);

  function alertTitle(alert: StoredAlert): string {
    if (alert.type === 'registered') {
      return t('alerts.registered');
    }
    if (alert.type === 'complement') {
      return t('alerts.complement');
    }
    if (alert.type === 'response_ready') {
      return t('alerts.responseReady');
    }
    return t('alerts.statusUpdated', {
      statut: statusLabel(t, alert.statutCode ?? ''),
    });
  }

  function alertDetail(alert: StoredAlert): string {
    if (alert.type === 'registered') {
      return t('alerts.registeredDetail', { reference: alert.reference });
    }
    if (alert.type === 'complement') {
      return t('alerts.dossierDetail', {
        reference: alert.reference,
        detail: t('alerts.complementDetail'),
      });
    }
    if (alert.type === 'response_ready') {
      return t('alerts.dossierDetail', {
        reference: alert.reference,
        detail: t('alerts.resolvedDetail'),
      });
    }
    return t('alerts.dossierLine', { reference: alert.reference });
  }

  function alertIcon(alert: StoredAlert): {
    name: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
  } {
    if (alert.type === 'registered') {
      return { name: 'document-text-outline', color: '#2563EB', bg: '#DBEAFE' };
    }
    if (alert.type === 'complement') {
      return { name: 'mail-outline', color: '#7C3AED', bg: '#EDE9FE' };
    }
    if (alert.type === 'response_ready') {
      return { name: 'checkmark-circle-outline', color: '#16A34A', bg: '#DCFCE7' };
    }
    return { name: 'refresh-outline', color: '#EA580C', bg: '#FFEDD5' };
  }

  function renderGroup(title: string, items: StoredAlert[]) {
    if (items.length === 0) {
      return null;
    }
    return (
      <View style={{ gap: 8 }}>
        <Text style={[styles.group, isRTL && styles.rtl]}>{title}</Text>
        <Card style={{ paddingVertical: 4, paddingHorizontal: 0 }}>
          {items.map((alert, index) => {
            const icon = alertIcon(alert);
            return (
              <Pressable
                key={alert.id}
                onPress={() => {
                  void markRead(alert.id);
                  router.push({
                    pathname: '/suivi/verifier',
                    params: { reference: alert.reference, locked: '1' },
                  });
                }}
                style={[
                  styles.alertRow,
                  isRTL && styles.rowRtl,
                  index < items.length - 1 && styles.alertBorder,
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                  <Ionicons name={icon.name} size={18} color={icon.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={[styles.titleRow, isRTL && styles.rowRtl]}>
                    <Text style={[styles.alertTitle, isRTL && styles.rtl, { flex: 1 }]}>
                      {alertTitle(alert)}
                    </Text>
                    <View style={[styles.meta, isRTL && styles.rowRtl]}>
                      <Text style={styles.time}>{formatTime(alert.createdAt, lang)}</Text>
                      {!alert.read ? <View style={styles.unread} /> : null}
                    </View>
                  </View>
                  <Text style={[styles.detail, isRTL && styles.rtl]}>{alertDetail(alert)}</Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.header, isRTL && styles.rowRtl]}>
        <Text style={[styles.title, isRTL && styles.rtl]}>{t('alerts.title')}</Text>
        <Pressable onPress={() => void markAllRead()}>
          <Text style={styles.markAll}>{t('alerts.markAll')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {alerts.length === 0 ? (
          <Card>
            <EmptyState title={t('alerts.empty')} icon="notifications-outline" />
          </Card>
        ) : (
          <>
            {renderGroup(t('alerts.today'), groups.today)}
            {renderGroup(t('alerts.thisWeek'), groups.week)}
            {renderGroup(t('alerts.older'), groups.older)}
          </>
        )}

        <Card style={[styles.notifCard, isRTL && styles.rowRtl]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.notifTitle, isRTL && styles.rtl]}>{t('alerts.notifTitle')}</Text>
            <Text style={[styles.notifHint, isRTL && styles.rtl]}>{t('alerts.notifHint')}</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(value) => void setNotifications(value)}
            trackColor={{ true: colors.institutional, false: colors.border }}
          />
        </Card>

        <View style={[styles.lockNote, isRTL && styles.rowRtl]}>
          <Ionicons name="lock-closed" size={16} color={colors.institutional} />
          <Text style={[styles.lockText, isRTL && styles.rtl]}>{t('alerts.lockNote')}</Text>
        </View>
      </ScrollView>
    </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  markAll: {
    color: colors.institutional,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  group: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  alertRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lightGray,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  unread: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.vivid,
  },
  detail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifTitle: {
    fontWeight: '700',
    color: colors.text,
  },
  notifHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  lockNote: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: '#B7E0C5',
    borderRadius: 16,
    padding: 14,
  },
  lockText: {
    flex: 1,
    color: colors.institutional,
    fontSize: 13,
    lineHeight: 18,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
