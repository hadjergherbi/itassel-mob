import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseApiError } from '@/api/client';
import {
  clearSuiviSession,
  fetchDossier,
  getSuiviSession,
  repondreComplement,
  type AttachmentFile,
  type ComplementItem,
} from '@/api/suivi';
import { Card } from '@/components/Card';
import { TextField } from '@/components/FormFields';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { Lang } from '@/i18n/fr';
import { colors, radius } from '@/theme';
import { localeFor } from '@/utils/dateLocale';

const MAX_BYTES = 5_242_880;

function formatDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) {
    return '';
  }
  return new Date(iso).toLocaleDateString(localeFor(lang), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} o`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} Ko`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function RepondreScreen() {
  const params = useLocalSearchParams<{ reference: string }>();
  const reference = decodeURIComponent(String(params.reference ?? '')).toUpperCase();
  const { t, lang, isRTL } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [complement, setComplement] = useState<ComplementItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState('');
  const [pieceError, setPieceError] = useState('');
  const [piece, setPiece] = useState<(AttachmentFile & { size?: number }) | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const pieceExigee = Boolean(complement?.piece_exigee);

  const goVerify = useCallback(() => {
    clearSuiviSession();
    router.replace({
      pathname: '/suivi/verifier',
      params: { reference, locked: '1' },
    });
  }, [router, reference]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getSuiviSession(reference)) {
        goVerify();
        return;
      }
      try {
        const data = await fetchDossier(reference);
        if (cancelled) {
          return;
        }
        const pending = data.complements?.find((c) => c.etat === 'en_attente') ?? null;
        if (!pending || data.statut?.code !== 'information_demandee') {
          Alert.alert(t('reply.noComplement'), undefined, [
            {
              text: t('common.ok'),
              onPress: () => router.replace({
                pathname: '/dossier/[reference]',
                params: { reference },
              }),
            },
          ]);
          return;
        }
        setComplement(pending);
      } catch (err) {
        const parsed = parseApiError(err);
        if (parsed.status === 401) {
          goVerify();
          return;
        }
        Alert.alert(t(parsed.messageKey), undefined, [
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reference, goVerify, router, t]);

  function confirmClose() {
    if (message.trim() || piece) {
      Alert.alert(t('reply.discardTitle'), t('reply.discardBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('reply.discardConfirm'),
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]);
      return;
    }
    router.back();
  }

  function validateFile(name: string, size?: number | null): boolean {
    const lower = name.toLowerCase();
    if (
      !lower.endsWith('.pdf') &&
      !lower.endsWith('.jpg') &&
      !lower.endsWith('.jpeg') &&
      !lower.endsWith('.png')
    ) {
      Alert.alert(t('dossier.fileType'));
      return false;
    }
    if (size && size > MAX_BYTES) {
      Alert.alert(t('dossier.fileTooLarge'));
      return false;
    }
    return true;
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const asset = result.assets[0];
    const name = asset.name || 'piece.pdf';
    if (!validateFile(name, asset.size)) {
      return;
    }
    setPiece({
      uri: asset.uri,
      name,
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size,
    });
    setPieceError('');
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const asset = result.assets[0];
    const name = asset.fileName || `photo_${Date.now()}.jpg`;
    if (!validateFile(name, asset.fileSize)) {
      return;
    }

    setPiece({
      uri: asset.uri,
      name,
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
    });
    setPieceError('');
  }

  function openPicker() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('reply.pickFile'), t('reply.pickPhoto')],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) void pickDocument();
          if (index === 2) void pickImage();
        },
      );
      return;
    }
    Alert.alert(t('reply.addAttachment'), undefined, [
      { text: t('reply.pickFile'), onPress: () => void pickDocument() },
      { text: t('reply.pickPhoto'), onPress: () => void pickImage() },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  async function onSubmit() {
    if (sendingRef.current || sending) {
      return;
    }
    if (!message.trim()) {
      setMessageError(t('reply.messageRequired'));
      return;
    }
    if (pieceExigee && !piece) {
      setPieceError(t('reply.pieceRequired'));
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setMessageError('');
    setPieceError('');

    try {
      await repondreComplement(reference, message.trim(), piece);
      Alert.alert(t('reply.success'), undefined, [
        {
          text: t('common.ok'),
          onPress: () =>
            router.replace({
              pathname: '/dossier/[reference]',
              params: { reference },
            }),
        },
      ]);
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.status === 401) {
        goVerify();
        return;
      }
      if (parsed.status === 404) {
        Alert.alert(t('reply.noComplement'), undefined, [
          {
            text: t('common.ok'),
            onPress: () =>
              router.replace({
                pathname: '/dossier/[reference]',
                params: { reference },
              }),
          },
        ]);
        return;
      }
      if (parsed.fieldErrors.message) {
        setMessageError(t('reply.messageRequired'));
      }
      if (parsed.fieldErrors.piece_jointe) {
        setPieceError(t('reply.pieceRequired'));
      }
      if (!parsed.fieldErrors.message && !parsed.fieldErrors.piece_jointe) {
        Alert.alert(t(parsed.messageKey));
      }
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }

  const canSend = Boolean(message.trim()) && (!pieceExigee || Boolean(piece)) && !sending;

  const bannerText =
    pieceExigee && complement
      ? complement.description_piece?.trim()
        ? t('reply.pieceBanner', { description: complement.description_piece.trim() })
        : t('reply.pieceBannerGeneric')
      : null;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />

      <View style={[styles.topBar, isRTL && styles.rowRtl]}>
        <Pressable
          style={styles.iconBtn}
          onPress={confirmClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>{t('reply.title')}</Text>
        <View style={{ width: 48 }} />
      </View>
      <View style={styles.divider} />

      {loading || !complement ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Card style={{ gap: 10, alignItems: 'center' }}>
              <Text style={styles.questionLabel}>{t('reply.questionLabel')}</Text>
              <Text style={[styles.question, isRTL && styles.rtl]}>
                « {complement.question ?? ''} »
              </Text>
              <Text style={styles.dossierLine}>
                {t('reply.dossierLine', {
                  reference,
                  date: formatDate(complement.date_demande, lang),
                })}
              </Text>
            </Card>

            {bannerText ? (
              <View style={[styles.banner, isRTL && styles.rowRtl]}>
                <Ionicons name="warning" size={18} color="#92400E" />
                <Text style={[styles.bannerText, isRTL && styles.rtl]}>{bannerText}</Text>
              </View>
            ) : null}

            <TextField
              label={t('reply.message')}
              required
              value={message}
              error={messageError}
              placeholder={t('reply.messagePlaceholder')}
              multiline
              maxLength={2000}
              onChangeText={(v) => {
                setMessage(v);
                setMessageError('');
              }}
            />

            <View style={styles.wrap}>
              <Text style={[styles.attachLabel, isRTL && styles.rtl]}>
                {t('reply.attachment')}
                {pieceExigee ? <Text style={styles.asterisk}> *</Text> : null}
              </Text>

              {piece ? (
                <View style={[styles.fileRow, isRTL && styles.rowRtl]}>
                  <Ionicons name="document-attach" size={20} color={colors.institutional} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fileName, isRTL && styles.rtl]} numberOfLines={1}>
                      {piece.name}
                    </Text>
                    {piece.size ? (
                      <Text style={styles.fileSize}>{formatSize(piece.size)}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => setPiece(null)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('reply.remove')}
                  >
                    <Text style={styles.remove}>{t('reply.remove')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[styles.dashed, isRTL && styles.rowRtl]}
                  onPress={openPicker}
                  accessibilityRole="button"
                >
                  <Ionicons name="attach" size={20} color={colors.institutional} />
                  <Text style={styles.dashedText}>{t('reply.addAttachment')}</Text>
                </Pressable>
              )}
              <Text style={[styles.hint, isRTL && styles.rtl]}>{t('reply.attachmentHint')}</Text>
              {pieceError ? <Text style={styles.error}>{pieceError}</Text> : null}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <PrimaryButton
              label={sending ? t('reply.sending') : t('reply.submit')}
              icon="paper-plane-outline"
              loading={sending}
              disabled={!canSend}
              onPress={() => void onSubmit()}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
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
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  question: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  dossierLine: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFEDD5',
    borderRadius: radius.input,
    padding: 12,
    alignItems: 'flex-start',
  },
  bannerText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  wrap: {
    gap: 8,
  },
  attachLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  asterisk: {
    color: colors.danger,
    fontWeight: '700',
  },
  dashed: {
    minHeight: 56,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  dashedText: {
    color: colors.institutional,
    fontWeight: '700',
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 12,
    minHeight: 56,
  },
  fileName: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 14,
  },
  fileSize: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  remove: {
    color: colors.danger,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lightGray,
    backgroundColor: colors.background,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
