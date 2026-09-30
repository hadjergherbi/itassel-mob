import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '@/theme';

type Variant = 'solid' | 'outline' | 'welcome';

type Props = PressableProps & {
  label: string;
  loading?: boolean;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton(props: Props) {
  const { label, loading, variant = 'solid', disabled, icon, style, ...rest } = props;
  const isOutline = variant === 'outline';
  const isWelcome = variant === 'welcome';
  const fg = isOutline || isWelcome ? colors.institutional : colors.white;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={[
        styles.base,
        isOutline && styles.outline,
        isWelcome && styles.welcome,
        !isOutline && !isWelcome && styles.solid,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text
            style={[
              styles.label,
              (isOutline || isWelcome) && styles.labelDark,
              isWelcome && styles.labelWelcome,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  solid: {
    backgroundColor: colors.institutional,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.institutional,
  },
  welcome: {
    backgroundColor: colors.white,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  labelDark: {
    color: colors.institutional,
  },
  labelWelcome: {
    color: colors.welcome,
  },
});
