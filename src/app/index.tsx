import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';

import { useLanguage } from '@/i18n/LanguageProvider';
import { routes } from '@/navigation/routes';
import { colors } from '@/theme';

/**
 * Point d'entrée : redirige vers /langue ou les onglets
 * selon la langue déjà enregistrée dans SecureStore.
 */
export default function Index() {
  const { ready, hasChosenLanguage } = useLanguage();

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.institutional} size="large" />
      </View>
    );
  }

  if (!hasChosenLanguage) {
    return <Redirect href={routes.langue} />;
  }

  return <Redirect href={routes.tabs} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
