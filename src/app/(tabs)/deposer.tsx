import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseApiError } from '@/api/client';
import {
  createDoleance,
  ensureFreshJeton,
  fetchFormulaireJeton,
  getCachedJeton,
  getJetonAgeSeconds,
  waitMinAntiSpam,
} from '@/api/doleances';
import {
  fetchReferentiels,
  type NatureItem,
  type QualiteItem,
  type ServiceItem,
} from '@/api/referentiels';
import { Card } from '@/components/Card';
import {
  RefsErrorState,
  RefsLoadingState,
  SelectField,
  TextField,
} from '@/components/FormFields';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatutBadge } from '@/components/StatutBadge';
import { WILAYAS } from '@/data/wilayas';
import { useLanguage } from '@/i18n/LanguageProvider';
import { traduireLibelleReferentiel } from '@/i18n/referentielLabels';
import { routes } from '@/navigation/routes';
import { useAppStorage } from '@/storage/AppStorageProvider';
import {
  clearDepositDraft,
  loadDepositDraft,
  saveDepositDraft,
  type DepositDraftForm,
} from '@/storage/draft';
import { colors, radius } from '@/theme';
import { formatDateTime } from '@/utils/dateLocale';
import {
  formatLocalInput,
  formatPhoneDisplay,
  isValidAlgerianPhone,
  toApiPhone,
} from '@/utils/phone';

const NAME_RE = /^[\p{L} '\-]+$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONTACT_FIELDS = ['nom', 'prenom', 'email', 'telephone', 'wilaya'] as const;
const REQUEST_FIELDS = [
  'id_nature',
  'id_qualite',
  'id_service',
  'objet',
  'description',
] as const;

const FIELD_ERROR_KEYS: Record<string, string> = {
  nom: 'deposit.nameInvalid',
  prenom: 'deposit.nameInvalid',
  email: 'deposit.emailInvalid',
  telephone: 'deposit.phoneInvalid',
  description: 'deposit.tooLong',
  wilaya: 'deposit.required',
  objet: 'deposit.required',
  id_qualite: 'deposit.required',
  id_service: 'deposit.required',
  id_nature: 'deposit.required',
};

type FormState = {
  nom: string;
  prenom: string;
  email: string;
  telephoneLocal: string;
  wilaya: string;
  id_qualite: string;
  id_service: string;
  id_nature: string;
  objet: string;
  description: string;
};

const emptyForm: FormState = {
  nom: '',
  prenom: '',
  email: '',
  telephoneLocal: '',
  wilaya: '',
  id_qualite: '',
  id_service: '',
  id_nature: '',
  objet: '',
  description: '',
};

type RefsStatus = 'loading' | 'error' | 'empty' | 'ready';

type SuccessState = {
  reference: string;
  email: string;
  objet: string;
  depositedAt: Date;
  serviceLabel: string;
};

export default function DeposerScreen() {
  const { t, lang, isRTL } = useLanguage();
  const { addDossier, createLocalAlert } = useAppStorage();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [refsStatus, setRefsStatus] = useState<RefsStatus>('loading');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [natures, setNatures] = useState<NatureItem[]>([]);
  const [qualites, setQualites] = useState<QualiteItem[]>([]);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [keepOnPhone, setKeepOnPhone] = useState(true);
  const [copied, setCopied] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftReady = useRef(false);
  const submitting = useRef(false);

  const loadReferentiels = useCallback(async (force: boolean) => {
    setRefsStatus('loading');
    try {
      const [refsResult] = await Promise.all([
        fetchReferentiels(force),
        fetchFormulaireJeton().catch(() => null),
      ]);
      const { data } = refsResult;
      setServices(data.services);
      setNatures(data.natures);
      setQualites(data.qualites);
      const empty =
        data.qualites.length === 0 ||
        data.services.length === 0 ||
        data.natures.length === 0;
      setRefsStatus(empty ? 'empty' : 'ready');
    } catch {
      setServices([]);
      setNatures([]);
      setQualites([]);
      setRefsStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadReferentiels(false);
  }, [loadReferentiels]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadDepositDraft();
      if (cancelled || !draft) {
        draftReady.current = true;
        return;
      }
      setForm({
        nom: draft.nom,
        prenom: draft.prenom,
        email: draft.email,
        telephoneLocal: draft.telephoneLocal,
        wilaya: draft.wilaya,
        id_qualite: draft.id_qualite,
        id_service: draft.id_service,
        id_nature: draft.id_nature,
        objet: draft.objet,
        description: draft.description,
      });
      setStep(Math.min(Math.max(draft.step, 0), 2));
      setDraftRestored(true);
      draftReady.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draftReady.current || success) {
      return;
    }
    const payload: DepositDraftForm = { ...form, step };
    const timer = setTimeout(() => {
      void saveDepositDraft(payload);
    }, 400);
    return () => clearTimeout(timer);
  }, [form, step, success]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        // Quitter l'onglet pendant le succès → reset pour ne pas le réafficher
        setSuccess(null);
        setCopied(false);
      };
    }, []),
  );

  const qualiteOptions = useMemo(
    () =>
      qualites.map((q) => ({
        value: String(q.id_qualite),
        label: traduireLibelleReferentiel('qualites', q.libelle, lang),
      })),
    [qualites, lang],
  );

  const serviceOptions = useMemo(
    () =>
      services.map((s) => ({
        value: String(s.id_service),
        label: traduireLibelleReferentiel('services', s.nom_service, lang),
      })),
    [services, lang],
  );

  const wilayaOptions = useMemo(
    () =>
      WILAYAS.map((w) => ({
        value: w.nameFr,
        label: lang === 'ar' ? w.nameAr : lang === 'en' ? w.nameEn : w.nameFr,
      })),
    [lang],
  );

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      if (key === 'telephoneLocal') {
        delete next.telephone;
      }
      return next;
    });
  }

  function isContactValid(check: FormState = form): boolean {
    if (!check.nom.trim() || !NAME_RE.test(check.nom.trim()) || check.nom.trim().length > 60) {
      return false;
    }
    if (
      !check.prenom.trim() ||
      !NAME_RE.test(check.prenom.trim()) ||
      check.prenom.trim().length > 60
    ) {
      return false;
    }
    if (!check.email.trim() || !EMAIL_RE.test(check.email.trim()) || check.email.trim().length > 120) {
      return false;
    }
    if (!check.telephoneLocal.trim() || !isValidAlgerianPhone(check.telephoneLocal)) {
      return false;
    }
    if (!check.wilaya.trim()) {
      return false;
    }
    return true;
  }

  function isRequestValid(check: FormState = form): boolean {
    if (!check.id_nature || !check.id_qualite || !check.id_service) {
      return false;
    }
    if (!check.objet.trim() || check.objet.trim().length > 200) {
      return false;
    }
    if (!check.description.trim() || check.description.length > 5000) {
      return false;
    }
    return true;
  }

  function validateStep(current: number): boolean {
    const nextErrors: Record<string, string> = {};
    if (current === 0) {
      if (!form.nom.trim()) nextErrors.nom = t('deposit.required');
      else if (!NAME_RE.test(form.nom.trim()) || form.nom.trim().length > 60) {
        nextErrors.nom = t('deposit.nameInvalid');
      }
      if (!form.prenom.trim()) nextErrors.prenom = t('deposit.required');
      else if (!NAME_RE.test(form.prenom.trim()) || form.prenom.trim().length > 60) {
        nextErrors.prenom = t('deposit.nameInvalid');
      }
      if (!form.email.trim()) nextErrors.email = t('deposit.required');
      else if (!EMAIL_RE.test(form.email.trim()) || form.email.trim().length > 120) {
        nextErrors.email = t('deposit.emailInvalid');
      }
      if (!form.telephoneLocal.trim()) nextErrors.telephone = t('deposit.required');
      else if (!isValidAlgerianPhone(form.telephoneLocal)) {
        nextErrors.telephone = t('deposit.phoneInvalid');
      }
      if (!form.wilaya.trim()) nextErrors.wilaya = t('deposit.required');
    }
    if (current === 1) {
      if (!form.id_nature) nextErrors.id_nature = t('deposit.required');
      if (!form.id_qualite) nextErrors.id_qualite = t('deposit.required');
      if (!form.id_service) nextErrors.id_service = t('deposit.required');
      if (!form.objet.trim()) nextErrors.objet = t('deposit.required');
      if (!form.description.trim()) nextErrors.description = t('deposit.required');
      else if (form.description.length > 5000) {
        nextErrors.description = t('deposit.tooLong');
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function mapFieldErrors(fieldErrors: Record<string, string>): Record<string, string> {
    const mapped: Record<string, string> = {};
    Object.keys(fieldErrors).forEach((field) => {
      const localKey = FIELD_ERROR_KEYS[field];
      if (localKey) {
        const backendMsg = fieldErrors[field].toLowerCase();
        if (backendMsg.includes('required') || backendMsg.includes('obligatoire')) {
          mapped[field] = t('deposit.required');
        } else {
          mapped[field] = t(localKey);
        }
      } else {
        mapped[field] = fieldErrors[field];
      }
    });
    return mapped;
  }

  function stepForFieldErrors(fieldErrors: Record<string, string>): number {
    const keys = Object.keys(fieldErrors);
    if (keys.some((key) => (CONTACT_FIELDS as readonly string[]).includes(key))) {
      return 0;
    }
    if (keys.some((key) => (REQUEST_FIELDS as readonly string[]).includes(key))) {
      return 1;
    }
    return 0;
  }

  function isDirty(): boolean {
    return Object.values(form).some((v) => String(v).trim() !== '');
  }

  function resetAll() {
    setForm(emptyForm);
    setErrors({});
    setStep(0);
    setSuccess(null);
    setCopied(false);
    setKeepOnPhone(true);
    setDraftRestored(false);
    void clearDepositDraft();
  }

  function confirmLeave(onLeave: () => void) {
    if (!isDirty() || success) {
      onLeave();
      return;
    }
    Alert.alert(t('deposit.discardTitle'), t('deposit.discardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('deposit.discardConfirm'),
        style: 'destructive',
        onPress: () => {
          resetAll();
          onLeave();
        },
      },
    ]);
  }

  async function onSubmit() {
    if (submitting.current || loading) {
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      if (getJetonAgeSeconds() > 7200 || !getCachedJeton()) {
        await fetchFormulaireJeton();
      } else {
        await ensureFreshJeton();
      }
      await waitMinAntiSpam();

      let jeton = await ensureFreshJeton();
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim(),
        telephone: toApiPhone(form.telephoneLocal),
        wilaya: form.wilaya,
        objet: form.objet.trim(),
        description: form.description.trim(),
        id_service: Number(form.id_service),
        id_nature: Number(form.id_nature),
        id_qualite: Number(form.id_qualite),
        jeton_formulaire: jeton,
        site_web: '',
      };

      let result;
      try {
        result = await createDoleance(payload);
      } catch (err) {
        const parsed = parseApiError(err);
        const onlyMessage =
          parsed.status === 422 &&
          Object.keys(parsed.fieldErrors).length === 0 &&
          Boolean(parsed.message);
        if (!onlyMessage) {
          throw err;
        }
        // Anti-spam : un seul nouvel essai
        await fetchFormulaireJeton();
        await waitMinAntiSpam();
        jeton = await ensureFreshJeton();
        try {
          result = await createDoleance({ ...payload, jeton_formulaire: jeton });
        } catch (retryErr) {
          const retryParsed = parseApiError(retryErr);
          if (
            retryParsed.status === 422 &&
            Object.keys(retryParsed.fieldErrors).length === 0
          ) {
            Alert.alert(t('deposit.spamRejected'));
            return;
          }
          throw retryErr;
        }
      }

      const service = services.find((s) => String(s.id_service) === form.id_service);
      const serviceLabel = service
        ? traduireLibelleReferentiel('services', service.nom_service, lang)
        : '';

      await clearDepositDraft();
      setDraftRestored(false);
      setSuccess({
        reference: result.reference,
        email: form.email.trim(),
        objet: form.objet.trim(),
        depositedAt: new Date(),
        serviceLabel,
      });
    } catch (err) {
      const parsed = parseApiError(err);
      if (Object.keys(parsed.fieldErrors).length > 0) {
        const mapped = mapFieldErrors(parsed.fieldErrors);
        setErrors(mapped);
        setStep(stepForFieldErrors(parsed.fieldErrors));
      }
      if (parsed.status === 422 && Object.keys(parsed.fieldErrors).length === 0) {
        Alert.alert(t('deposit.spamRejected'));
      } else {
        Alert.alert(t(parsed.messageKey));
      }
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  async function leaveSuccess(target: 'dossiers' | 'home') {
    if (success && keepOnPhone) {
      await addDossier(success.reference, 'nouvelle', success.objet);
      await createLocalAlert('registered', success.reference, 'nouvelle');
    }
    resetAll();
    if (target === 'dossiers') {
      router.push('/(tabs)/dossiers');
    } else {
      router.push(routes.tabs);
    }
  }

  function labelQualite(id: string): string {
    const item = qualites.find((q) => String(q.id_qualite) === id);
    return item ? traduireLibelleReferentiel('qualites', item.libelle, lang) : '';
  }

  function labelService(id: string): string {
    const item = services.find((s) => String(s.id_service) === id);
    return item ? traduireLibelleReferentiel('services', item.nom_service, lang) : '';
  }

  function labelNature(id: string): string {
    const item = natures.find((n) => String(n.id_nature) === id);
    return item ? traduireLibelleReferentiel('natures', item.libelle, lang) : '';
  }

  function wilayaLabel(nameFr: string): string {
    const w = WILAYAS.find((item) => item.nameFr === nameFr);
    if (!w) return nameFr;
    return lang === 'ar' ? w.nameAr : lang === 'en' ? w.nameEn : w.nameFr;
  }

  if (success) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.successHeader, isRTL && styles.rowRtl]}>
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => void leaveSuccess('home')}
            style={styles.iconBtn}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.successContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={36} color={colors.white} />
          </View>
          <Text style={[styles.successTitle, isRTL && styles.rtl]}>{t('deposit.successTitle')}</Text>
          <SuccessEmailText email={success.email} rtl={isRTL} />

          <View style={styles.refCard}>
            <Text style={[styles.refLabel, isRTL && styles.rtl]}>{t('deposit.successRef')}</Text>
            <Text
              style={styles.refValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {success.reference}
            </Text>
            <View style={[styles.refActions, isRTL && styles.rowRtl]}>
              <Pressable
                style={[styles.refActionBtn, isRTL && styles.rowRtl]}
                onPress={async () => {
                  await Clipboard.setStringAsync(success.reference);
                  setCopied(true);
                }}
              >
                <Ionicons name="copy-outline" size={18} color={colors.institutional} />
                <Text style={styles.refActionText}>
                  {copied ? t('deposit.copied') : t('deposit.copy')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.refActionBtn, isRTL && styles.rowRtl]}
                onPress={() => void Share.share({ message: success.reference })}
              >
                <Ionicons name="share-outline" size={18} color={colors.institutional} />
                <Text style={styles.refActionText}>{t('deposit.share')}</Text>
              </Pressable>
            </View>
          </View>

          <Card style={{ gap: 0, paddingVertical: 4 }}>
            <MetaRow
              label={t('deposit.depositedAt')}
              value={formatDateTime(success.depositedAt, lang)}
              rtl={isRTL}
            />
            <MetaRow label={t('deposit.domain')} value={success.serviceLabel} rtl={isRTL} />
            <View style={[styles.metaRow, isRTL && styles.rowRtl]}>
              <Text style={[styles.metaLabel, isRTL && styles.rtl]}>{t('deposit.status')}</Text>
              <StatutBadge code="nouvelle" />
            </View>
          </Card>

          <View style={[styles.keepRow, isRTL && styles.rowRtl]}>
            <Text style={[styles.keepText, isRTL && styles.rtl, { flex: 1 }]}>
              {t('deposit.keepOnPhone')}
            </Text>
            <Switch
              value={keepOnPhone}
              onValueChange={setKeepOnPhone}
              trackColor={{ true: colors.institutional, false: colors.border }}
            />
          </View>

          <PrimaryButton
            label={t('deposit.goDossier')}
            onPress={() => void leaveSuccess('dossiers')}
          />
          <PrimaryButton
            label={t('deposit.goHome')}
            variant="outline"
            onPress={() => void leaveSuccess('home')}
          />
        </ScrollView>
      </View>
    );
  }

  const stepLabels = [
    t('deposit.stepContact'),
    t('deposit.stepInfo'),
    t('deposit.stepReview'),
  ];

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
          onPress={() => {
            if (step === 0) {
              confirmLeave(() => router.push(routes.tabs));
            } else {
              setStep(step - 1);
            }
          }}
        >
          <Ionicons
            name={step === 0 ? 'close' : isRTL ? 'arrow-forward' : 'arrow-back'}
            size={24}
            color={colors.text}
          />
        </Pressable>
        <Text style={styles.topTitle}>{t('deposit.title')}</Text>
        <Text style={styles.stepCounter}>{`${step + 1}/3`}</Text>
      </View>

      <View style={[styles.progressRow, isRTL && styles.rowRtl]}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[styles.progressSeg, i <= step ? styles.progressSegOn : null]}
          />
        ))}
      </View>
      <View style={[styles.stepLabels, isRTL && styles.rowRtl]}>
        {stepLabels.map((label, i) => (
          <Text
            key={label}
            style={[
              styles.stepLabel,
              i === step && styles.stepLabelOn,
              isRTL && styles.rtl,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>

      {refsStatus !== 'ready' && step >= 1 ? (
        <Card style={{ marginHorizontal: 16, marginTop: 8 }}>
          {refsStatus === 'loading' ? (
            <RefsLoadingState message={t('deposit.refsLoading')} />
          ) : (
            <RefsErrorState
              message={
                refsStatus === 'empty' ? t('deposit.loadEmpty') : t('deposit.loadError')
              }
              retryLabel={t('deposit.loadRetry')}
              onRetry={() => void loadReferentiels(true)}
              isRTL={isRTL}
            />
          )}
        </Card>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 ? (
            <View style={{ gap: 14 }}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
                {t('deposit.sectionContact')}
              </Text>
              <Text style={[styles.sectionHelp, isRTL && styles.rtl]}>
                {t('deposit.sectionContactHelp')}
              </Text>

              {draftRestored ? (
                <View style={[styles.draftBanner, isRTL && styles.rowRtl]}>
                  <Ionicons name="time-outline" size={18} color={colors.institutional} />
                  <Text style={[styles.draftText, isRTL && styles.rtl, { flex: 1 }]}>
                    {t('deposit.draftRestored')}
                  </Text>
                  <Pressable
                    onPress={() => {
                      resetAll();
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.draftClear}>{t('deposit.draftClear')}</Text>
                  </Pressable>
                </View>
              ) : null}

              <TextField
                label={t('deposit.nom')}
                required
                value={form.nom}
                error={errors.nom}
                maxLength={60}
                onChangeText={(v) => setField('nom', v)}
              />
              <TextField
                label={t('deposit.prenom')}
                required
                value={form.prenom}
                error={errors.prenom}
                hint={t('deposit.nameHint')}
                maxLength={60}
                onChangeText={(v) => setField('prenom', v)}
              />
              <TextField
                label={t('deposit.email')}
                required
                value={form.email}
                error={errors.email}
                hint={t('deposit.emailHint')}
                placeholder={t('deposit.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={120}
                onChangeText={(v) => setField('email', v)}
              />

              <View style={styles.wrap}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtl]}>
                  {t('deposit.telephone')}
                  <Text style={styles.asterisk}> *</Text>
                </Text>
                <View style={[styles.phoneRow, isRTL && styles.rowRtl]}>
                  <View style={styles.prefixBox}>
                    <Text style={styles.prefixText}>{t('deposit.phonePrefix')}</Text>
                  </View>
                  <TextInput
                    value={form.telephoneLocal}
                    onChangeText={(v) => setField('telephoneLocal', formatLocalInput(v))}
                    keyboardType="phone-pad"
                    placeholder="555 00 00 00"
                    placeholderTextColor={colors.textSecondary}
                    style={[
                      styles.phoneInput,
                      errors.telephone ? styles.inputError : null,
                      isRTL && styles.rtl,
                    ]}
                    maxLength={14}
                  />
                </View>
                {errors.telephone ? (
                  <Text style={styles.error}>{errors.telephone}</Text>
                ) : null}
              </View>

              <SelectField
                label={t('deposit.wilaya')}
                required
                placeholder={t('deposit.choose')}
                value={form.wilaya}
                error={errors.wilaya}
                onChange={(value) => setField('wilaya', value)}
                options={wilayaOptions}
              />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={{ gap: 14 }}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
                {t('deposit.sectionRequest')}
              </Text>

              <View style={styles.wrap}>
                <Text style={[styles.fieldLabel, isRTL && styles.rtl]}>
                  {t('deposit.nature')}
                  <Text style={styles.asterisk}> *</Text>
                </Text>
                <View style={[styles.chips, isRTL && styles.rowRtl]}>
                  {natures.map((n) => {
                    const selected = form.id_nature === String(n.id_nature);
                    return (
                      <Pressable
                        key={n.id_nature}
                        onPress={() => setField('id_nature', String(n.id_nature))}
                        style={[styles.chip, selected && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                          {traduireLibelleReferentiel('natures', n.libelle, lang)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.id_nature ? (
                  <Text style={styles.error}>{errors.id_nature}</Text>
                ) : null}
              </View>

              <SelectField
                label={t('deposit.qualite')}
                required
                placeholder={t('deposit.choose')}
                value={form.id_qualite}
                error={errors.id_qualite}
                onChange={(value) => setField('id_qualite', value)}
                options={qualiteOptions}
              />
              <SelectField
                label={t('deposit.service')}
                required
                placeholder={t('deposit.choose')}
                value={form.id_service}
                error={errors.id_service}
                onChange={(value) => setField('id_service', value)}
                options={serviceOptions}
              />
              <TextField
                label={t('deposit.objet')}
                required
                value={form.objet}
                error={errors.objet}
                placeholder={t('deposit.objetPlaceholder')}
                maxLength={200}
                onChangeText={(v) => setField('objet', v)}
              />
              <View>
                <TextField
                  label={t('deposit.description')}
                  required
                  value={form.description}
                  error={errors.description}
                  placeholder={t('deposit.descriptionPlaceholder')}
                  multiline
                  maxLength={5000}
                  onChangeText={(v) => setField('description', v)}
                />
                <Text style={[styles.charCount, isRTL && styles.rtl]}>
                  {t('deposit.charCount', { count: form.description.length })}
                </Text>
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ gap: 14 }}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
                {t('deposit.sectionReview')}
              </Text>
              <Text style={[styles.sectionHelp, isRTL && styles.rtl]}>
                {t('deposit.sectionReviewHelp')}
              </Text>

              <Card style={{ gap: 10 }}>
                <View style={[styles.reviewHead, isRTL && styles.rowRtl]}>
                  <Text style={[styles.reviewCardTitle, isRTL && styles.rtl]}>
                    {t('deposit.stepContact')}
                  </Text>
                  <Pressable
                    onPress={() => setStep(0)}
                    style={[styles.editLink, isRTL && styles.rowRtl]}
                    hitSlop={8}
                  >
                    <Ionicons name="pencil" size={14} color={colors.institutional} />
                    <Text style={styles.editText}>{t('deposit.edit')}</Text>
                  </Pressable>
                </View>
                <ReviewRow
                  label={t('deposit.fullName')}
                  value={`${form.prenom} ${form.nom}`.trim()}
                  rtl={isRTL}
                />
                <ReviewRow label={t('deposit.email')} value={form.email} rtl={isRTL} />
                <ReviewRow
                  label={t('deposit.telephone')}
                  value={formatPhoneDisplay(form.telephoneLocal)}
                  rtl={isRTL}
                  oneLine
                />
                <ReviewRow
                  label={t('deposit.wilaya')}
                  value={wilayaLabel(form.wilaya)}
                  rtl={isRTL}
                />
              </Card>

              <Card style={{ gap: 10 }}>
                <View style={[styles.reviewHead, isRTL && styles.rowRtl]}>
                  <Text style={[styles.reviewCardTitle, isRTL && styles.rtl]}>
                    {t('deposit.stepInfo')}
                  </Text>
                  <Pressable
                    onPress={() => setStep(1)}
                    style={[styles.editLink, isRTL && styles.rowRtl]}
                    hitSlop={8}
                  >
                    <Ionicons name="pencil" size={14} color={colors.institutional} />
                    <Text style={styles.editText}>{t('deposit.edit')}</Text>
                  </Pressable>
                </View>
                <ReviewRow
                  label={t('deposit.natureQualiteService')}
                  value={`${labelNature(form.id_nature)} · ${labelQualite(form.id_qualite)} · ${labelService(form.id_service)}`}
                  rtl={isRTL}
                />
                <ReviewRow label={t('deposit.objet')} value={form.objet} rtl={isRTL} />
                <ReviewRow
                  label={t('deposit.description')}
                  value={form.description}
                  rtl={isRTL}
                />
              </Card>
            </View>
          ) : null}
        </ScrollView>
      )}

      {(step === 0 || (step === 1 && refsStatus === 'ready') || step === 2) && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 2 ? (
            <>
              <PrimaryButton
                label={loading ? t('deposit.sending') : t('deposit.submit')}
                icon="paper-plane-outline"
                loading={loading}
                disabled={loading}
                onPress={() => void onSubmit()}
              />
              <Text style={[styles.privacy, isRTL && styles.rtl]}>
                {t('deposit.privacyFooter')}
              </Text>
            </>
          ) : (
            <PrimaryButton
              label={step === 0 ? t('deposit.next') : t('deposit.nextReview')}
              disabled={step === 0 ? !isContactValid() : !isRequestValid()}
              onPress={() => {
                if (validateStep(step)) {
                  if (step === 0) {
                    void fetchFormulaireJeton().catch(() => null);
                  }
                  setStep(step + 1);
                }
              }}
            />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function SuccessEmailText(props: { email: string; rtl: boolean }) {
  const { t } = useLanguage();
  const template = t('deposit.successEmail', { email: '<<<EMAIL>>>' });
  const [before, after = ''] = template.split('<<<EMAIL>>>');
  return (
    <Text style={[styles.successEmail, props.rtl && styles.rtl]}>
      {before}
      <Text style={styles.successEmailBold}>{props.email}</Text>
      {after}
    </Text>
  );
}

function ReviewRow(props: {
  label: string;
  value: string;
  rtl: boolean;
  oneLine?: boolean;
}) {
  return (
    <View>
      <Text style={[styles.reviewLabel, props.rtl && styles.rtl]}>{props.label}</Text>
      <Text
        style={[styles.reviewValue, props.rtl && styles.rtl]}
        numberOfLines={props.oneLine ? 1 : undefined}
      >
        {props.value}
      </Text>
    </View>
  );
}

function MetaRow(props: { label: string; value: string; rtl: boolean }) {
  return (
    <View style={[styles.metaRow, props.rtl && styles.rowRtl]}>
      <Text style={[styles.metaLabel, props.rtl && styles.rtl]}>{props.label}</Text>
      <Text style={[styles.metaValue, props.rtl && styles.rtl]}>{props.value}</Text>
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
    paddingHorizontal: 12,
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
  stepCounter: {
    minWidth: 40,
    textAlign: 'right',
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lightGray,
  },
  progressSegOn: {
    backgroundColor: colors.institutional,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  stepLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  stepLabelOn: {
    color: colors.institutional,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  sectionHelp: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -6,
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E8F5EE',
    borderRadius: radius.input,
    padding: 12,
  },
  draftText: {
    color: colors.institutional,
    fontSize: 13,
    fontWeight: '600',
  },
  draftClear: {
    color: colors.institutional,
    fontWeight: '800',
    fontSize: 13,
  },
  wrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  asterisk: {
    color: colors.danger,
    fontWeight: '700',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  prefixBox: {
    minWidth: 72,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  prefixText: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 15,
  },
  phoneInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.chip,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: colors.institutional,
    borderColor: colors.institutional,
  },
  chipText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextOn: {
    color: colors.white,
  },
  charCount: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reviewCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editText: {
    color: colors.institutional,
    fontWeight: '700',
    fontSize: 13,
  },
  reviewLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reviewValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lightGray,
    gap: 8,
  },
  privacy: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  successHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  successContent: {
    padding: 16,
    gap: 14,
    alignItems: 'stretch',
  },
  successIcon: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.vivid,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  successEmail: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  successEmailBold: {
    fontWeight: '800',
    color: colors.text,
  },
  refCard: {
    backgroundColor: '#E8F5EE',
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  refLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  refValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.institutional,
    width: '100%',
    textAlign: 'center',
  },
  refActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  refActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.institutional,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  refActionText: {
    color: colors.institutional,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lightGray,
    gap: 12,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  metaValue: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  keepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  keepText: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 15,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
