import 'react-native-gesture-handler';

import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { LanguageProvider, useLanguage } from '@/i18n/LanguageProvider';
import { AppStorageProvider } from '@/storage/AppStorageProvider';
import { colors } from '@/theme';

function RootNavigator() {
  const { ready, hasChosenLanguage } = useLanguage();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.institutional} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={hasChosenLanguage ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="langue" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="dossier/[reference]" options={{ headerShown: false }} />
        <Stack.Screen name="suivi/verifier" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <LanguageProvider>
        <AppStorageProvider>
          <RootNavigator />
        </AppStorageProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
