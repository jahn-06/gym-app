import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, View, useColorScheme } from 'react-native';

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

  const content = (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );

  // Na nativním telefonu appka prostě zabírá celou obrazovku, žádný
  // "telefon v telefonu" efekt nedává smysl - tohle je jen pro web,
  // když appku někdo otevře přímo v prohlížeči mimo náš <iframe>
  // rámeček na portfoliu.
  if (Platform.OS !== 'web') {
    return content;
  }

  return (
    <View style={styles.webOuter}>
      <View style={styles.webPhoneBox}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Celá plocha prohlížeče - čistě černé pozadí, appka (telefonní box)
  // vystředěná uprostřed. Sem se dá později přidat i doprovodný grafický
  // obsah okolo (název appky, popisky funkcí atd.).
  webOuter: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // Samotný "telefon" - poměr stran cca 9:19.5 jako skutečné zařízení,
  // maxWidth omezuje, aby to na širokém monitoru nebylo obří, rámeček +
  // stín dělají dojem fyzického telefonu.
  webPhoneBox: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 9 / 19.5,
    borderRadius: 44,
    borderWidth: 10,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 24,
  },
});
