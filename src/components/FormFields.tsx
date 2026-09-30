import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '@/i18n/LanguageProvider';
import { colors, radius } from '@/theme';

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  onChange: (value: string) => void;
};

export function SelectField(props: SelectProps) {
  const { t, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const selected = props.options.find((item) => item.value === props.value);
  const emptyMessage = props.emptyMessage ?? t('deposit.loadEmpty');

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, isRTL && styles.rtl]}>
        {props.label}
        {props.required ? <Text style={styles.asterisk}> *</Text> : null}
      </Text>
      <Pressable
        disabled={props.disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[
          styles.input,
          styles.touchTarget,
          props.error ? styles.inputError : null,
          props.disabled ? styles.disabled : null,
          isRTL && styles.rowRtl,
        ]}
      >
        <Text
          style={[
            selected ? styles.value : styles.placeholder,
            isRTL && styles.rtl,
            { flex: 1 },
          ]}
        >
          {selected ? selected.label : props.placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalHeader, isRTL && styles.rowRtl]}>
              <Text style={[styles.modalTitle, isRTL && styles.rtl]}>{props.label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            {props.options.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyText, isRTL && styles.rtl]}>{emptyMessage}</Text>
              </View>
            ) : (
              <FlatList
                data={props.options}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.option, isRTL && styles.rowRtl]}
                    onPress={() => {
                      props.onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, isRTL && styles.rtl]}>{item.label}</Text>
                    {item.value === props.value ? (
                      <Ionicons name="checkmark" size={18} color={colors.institutional} />
                    ) : null}
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
};

export function TextField(props: FieldProps) {
  const { label, error, hint, required, style, multiline, ...rest } = props;
  const { isRTL } = useLanguage();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, isRTL && styles.rtl]}>
        {label}
        {required ? <Text style={styles.asterisk}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.textarea,
          error ? styles.inputError : null,
          isRTL && styles.rtl,
          style,
        ]}
        {...rest}
      />
      {hint && !error ? <Text style={[styles.hint, isRTL && styles.rtl]}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function RefsLoadingState(props: { message: string }) {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.institutional} size="large" />
      <Text style={styles.stateText}>{props.message}</Text>
    </View>
  );
}

export function RefsErrorState(props: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  isRTL?: boolean;
}) {
  return (
    <View style={styles.stateBox}>
      <Text style={[styles.stateText, props.isRTL && styles.rtl]}>{props.message}</Text>
      <Pressable style={styles.retryBtn} onPress={props.onRetry}>
        <Text style={styles.retryText}>{props.retryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  asterisk: {
    color: colors.danger,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  touchTarget: {
    minHeight: 48,
  },
  textarea: {
    minHeight: 110,
  },
  inputError: {
    borderColor: colors.danger,
  },
  disabled: {
    opacity: 0.55,
  },
  value: {
    color: colors.text,
    fontSize: 16,
  },
  placeholder: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lightGray,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  stateBox: {
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  stateText: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.institutional,
    borderRadius: radius.button,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
});
