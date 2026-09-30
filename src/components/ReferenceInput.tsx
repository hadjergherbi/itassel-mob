import { TextInput, View, Text, StyleSheet, type TextInputProps } from 'react-native';

import { useLanguage } from '@/i18n/LanguageProvider';
import { colors, radius } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function ReferenceInput(props: Props) {
  const { label, error, style, ...rest } = props;
  const { isRTL } = useLanguage();

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, isRTL && styles.rtlText]}>{label}</Text>
      ) : null}
      <TextInput
        autoCapitalize="characters"
        autoCorrect={false}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          isRTL && styles.rtlText,
          error ? styles.inputError : null,
          style,
        ]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
