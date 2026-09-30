import { Stack } from 'expo-router';

export default function DossierLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="repondre" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
