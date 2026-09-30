import { View, StyleSheet, type ViewProps } from 'react-native';

import { colors, radius, shadow } from '@/theme';

type Props = ViewProps & {
  children: React.ReactNode;
};

export function Card(props: Props) {
  const { style, children, ...rest } = props;
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 16,
    ...shadow.card,
  },
});
