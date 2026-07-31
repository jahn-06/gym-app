import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/context/auth';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading } = useAuth();

  useEffect(() => {
    // Jakmile víme, jestli je uživatel přihlášený, schováme úvodní
    // splash screen (do té doby by uživatel na zlomek sekundy uviděl
    // "blik" mezi login a home obrazovkou).
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Stack.Protected = tuhle skupinu obrazovek smí vidět jen uživatel,
          který splňuje podmínku "guard". Když podmínka neplatí, expo-router
          automaticky přesměruje na první dostupnou "nechráněnou" skupinu. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="buy-membership"
          options={{ headerShown: true, title: 'Koupit permanentku', presentation: 'modal' }}
        />
        <Stack.Screen name="classes" options={{ headerShown: true, title: 'Lekce', presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* /demo, /reset-password a /confirm-email nemají žádný guard - jsou
          dostupné vždy, ať je uživatel přihlášený nebo ne. */}
      <Stack.Screen name="demo" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="confirm-email" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}