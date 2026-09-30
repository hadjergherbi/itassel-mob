import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseApiError } from '@/api/client';
import { demanderCode, getSuiviSession, verifierCode } from '@/api/suivi';
import { PrimaryButton } from '@/components/PrimaryButton';
import { isValidReference } from '@/constants/reference';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useAppStorage } from '@/storage/AppStorageProvider';
import { colors, radius } from '@/theme';

const RESEND_SECONDS = 60;
const CODE_LEN = 6;

export default function SuiviVerifierScreen() {
  const { t, isRTL } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addDossier } = useAppStorage();
  const params = useLocalSearchParams<{
    reference?: string;
    locked?: string;
  }>();

  const initialRef = String(params.reference ?? '')
    .trim()
    .toUpperCase();
  const locked = params.locked === '1' || params.locked === 'true';

  const [reference, setReference] = useState(initialRef);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(''));
  const [error, setError] = useState('');
  const [infoVisible, setInfoVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const sentOnce = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const code = digits.join('');

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startCooldown() {
    clearTimer();
    setCooldown(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const sendCode = useCallback(
    async (ref: string) => {
      setLoading(true);
      setError('');
      try {
        await demanderCode(ref);
        setInfoVisible(true);
        startCooldown();
      } catch (err) {
        const parsed = parseApiError(err);
        setError(t(parsed.messageKey));
        setInfoVisible(false);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!initialRef || !isValidReference(initialRef)) {
      return;
    }
    if (getSuiviSession(initialRef)) {
      router.replace({
        pathname: '/dossier/[reference]',
        params: { reference: initialRef },
      });
      return;
    }
    if (!sentOnce.current) {
      sentOnce.current = true;
      void sendCode(initialRef);
    }
    return () => clearTimer();
  }, [initialRef, router, sendCode]);

  function onReferenceChange(value: string) {
    if (locked) {
      return;
    }
    setReference(value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
    setError('');
  }

  function setDigitAt(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 1) {
      // Collage d'un code complet
      const chars = cleaned.slice(0, CODE_LEN).split('');
      const next = Array(CODE_LEN).fill('');
      chars.forEach((c, i) => {
        next[i] = c;
      });
      setDigits(next);
      const focusAt = Math.min(chars.length, CODE_LEN - 1);
      inputsRef.current[focusAt]?.focus();
      setError('');
      return;
    }
    const next = [...digits];
    next[index] = cleaned.slice(-1);
    setDigits(next);
    setError('');
    if (cleaned && index < CODE_LEN - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function onKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function onResend() {
    const ref = reference.trim().toUpperCase();
    if (!isValidReference(ref)) {
      setError(t('errors.invalidReference'));
      return;
    }
    if (cooldown > 0) {
      return;
    }
    await sendCode(ref);
  }

  async function onVerify() {
    const ref = reference.trim().toUpperCase();
    if (!isValidReference(ref)) {
      setError(t('errors.invalidReference'));
      return;
    }
    if (code.length !== CODE_LEN) {
      setError(t('code.invalid'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifierCode(ref, code);
      await addDossier(ref, null);
      router.replace({
        pathname: '/dossier/[reference]',
        params: { reference: ref },
      });
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.status === 422) {
        setError(t('code.invalid'));
      } else {
        setError(t(parsed.messageKey));
      }
      setDigits(Array(CODE_LEN).fill(''));
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  const minutes = Math.floor(cooldown / 60);
  const seconds = cooldown % 60;
  const timeLabel = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, isRTL && styles.rowRtl]}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          style={styles.iconBtn}
          onPress={() => router.back()}
        >
          <Ionicons
            name={isRTL ? 'arrow-forward' : 'arrow-back'}
            size={24}
            color={colors.text}
          />
        </Pressable>
        <Text style={styles.topTitle}>{t('code.screenTitle')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed" size={22} color={colors.institutional} />
        </View>
        <Text style={[styles.title, isRTL && styles.rtl]}>{t('code.verifyTitle')}</Text>
        <Text style={[styles.help, isRTL && styles.rtl]}>{t('code.verifyHelp')}</Text>

        <View style={styles.wrap}>
          <Text style={[styles.label, isRTL && styles.rtl]}>{t('code.reference')}</Text>
          <TextInput
            value={reference}
            editable={!locked}
            onChangeText={onReferenceChange}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ITS-2026-0000"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.refInput,
              locked && styles.refLocked,
              isRTL && styles.rtl,
            ]}
          />
        </View>

        {infoVisible ? (
          <View style={[styles.infoBox, isRTL && styles.rowRtl]}>
            <Ionicons name="mail-outline" size={18} color={colors.institutional} />
            <Text style={[styles.infoText, isRTL && styles.rtl, { flex: 1 }]}>
              {t('code.sent')}
            </Text>
          </View>
        ) : null}

        <View style={styles.wrap}>
          <Text style={[styles.label, isRTL && styles.rtl]}>{t('code.label')}</Text>
          <View style={[styles.otpRow, isRTL && styles.rowRtl]}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                value={digit}
                onChangeText={(value) => setDigitAt(index, value)}
                onKeyPress={({ nativeEvent }) => onKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={index === 0 ? CODE_LEN : 1}
                style={[
                  styles.otpBox,
                  digit ? styles.otpFilled : null,
                  index === digits.findIndex((d) => !d) ? styles.otpFocus : null,
                ]}
                accessibilityLabel={`${t('code.label')} ${index + 1}`}
              />
            ))}
          </View>
        </View>

        <View style={[styles.resendRow, isRTL && styles.rowRtl]}>
          {cooldown > 0 ? (
            <Text style={[styles.resendWait, isRTL && styles.rtl]}>
              {t('code.resendIn', { time: timeLabel })}
            </Text>
          ) : (
            <Text style={[styles.resendWait, isRTL && styles.rtl]}> </Text>
          )}
          <Pressable
            disabled={cooldown > 0 || loading}
            onPress={() => void onResend()}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.resendLink,
                (cooldown > 0 || loading) && styles.resendDisabled,
              ]}
            >
              {t('code.resend')}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.limits, isRTL && styles.rtl]}>{t('code.limits')}</Text>

        {error ? <Text style={[styles.error, isRTL && styles.rtl]}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <PrimaryButton
          label={t('code.submit')}
          loading={loading}
          disabled={loading || code.length !== CODE_LEN || !isValidReference(reference)}
          onPress={() => void onVerify()}
        />
      </View>
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
    paddingHorizontal: 8,
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
  content: {
    padding: 16,
    gap: 14,
  },
  lockIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  help: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: -6,
  },
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  refInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  refLocked: {
    backgroundColor: '#F9FAFB',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#E8F5EE',
    borderRadius: radius.input,
    padding: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    color: colors.institutional,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  otpFilled: {
    borderColor: colors.institutional,
  },
  otpFocus: {
    borderColor: colors.institutional,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  resendWait: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  resendLink: {
    color: colors.institutional,
    fontWeight: '800',
    fontSize: 14,
    minHeight: 48,
    textAlignVertical: 'center',
    paddingVertical: 14,
  },
  resendDisabled: {
    opacity: 0.4,
  },
  limits: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
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
