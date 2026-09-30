import { Alert, DevSettings, I18nManager, Platform } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Applique le mode RTL (ou LTR). Si l'état change, affiche un message puis recharge.
 * Dev : DevSettings.reload() — Prod : Updates.reloadAsync()
 * @returns true si un rechargement a été déclenché
 */
export function applyRtlAndReload(enabled: boolean, message?: string): boolean {
  if (Platform.OS === 'web') {
    I18nManager.allowRTL(enabled);
    I18nManager.forceRTL(enabled);
    return false;
  }

  if (I18nManager.isRTL === enabled) {
    return false;
  }

  I18nManager.allowRTL(enabled);
  I18nManager.forceRTL(enabled);

  const text = message ?? "L'application va redémarrer";

  Alert.alert(text, undefined, [
    {
      text: 'OK',
      onPress: () => {
        if (__DEV__) {
          DevSettings.reload();
        } else {
          void Updates.reloadAsync();
        }
      },
    },
  ]);

  return true;
}
