import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

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

// 3 úrovně podle šířky okna:
// - PHONE: appka přes celou obrazovku, žádný dekorativní rámeček
// - MEDIUM: rámeček zůstává, ale bez postranních panelů (nevejdou se)
// - WIDE (>= WIDE_MIN_WIDTH): rámeček + oba postranní panely
const PHONE_MAX_WIDTH = 639;
const WIDE_MIN_WIDTH = 1000;

const TECHS = ['React Native + Expo', 'TypeScript', 'Supabase', 'Expo Router'];
const TIPS = [
  'Přihlaste se přes připravený demo účet',
  'Prohlédněte si QR kód pro vstup do fitka',
  'Zkuste zarezervovat lekci nebo koupit permanentku',
  'Podívejte se na streak a statistiky návštěvnosti',
];

function BrandHeader() {
  return (
    <>
      <Text style={styles.brandTitle}>IRON CORE</Text>
      <Text style={styles.brandSlogan}>Síla se nerodí, buduje se</Text>
    </>
  );
}

function TechSection() {
  return (
    <>
      <Text style={styles.sectionHeading}>Postaveno s</Text>
      <View style={styles.techRow}>
        {TECHS.map((label) => (
          <View key={label} style={styles.techBadge}>
            <Text style={styles.techBadgeText}>{label}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function TipsSection() {
  return (
    <>
      <Text style={styles.sectionHeading}>Jak appku vyzkoušet</Text>
      {TIPS.map((tip, i) => (
        <View key={tip} style={styles.tipRow}>
          <Text style={styles.tipNumber}>{i + 1}</Text>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ))}
    </>
  );
}

function LeftPanel() {
  return (
    <View style={styles.sidePanel}>
      <BrandHeader />
      <View style={{ marginTop: 32 }}>
        <TechSection />
      </View>
    </View>
  );
}

function RightPanel() {
  return (
    <View style={styles.sidePanel}>
      <TipsSection />
    </View>
  );
}

// Na telefonu se místo postranních panelů zobrazí jen malé plovoucí
// tlačítko (ⓘ) - po klepnutí vyjede zdola list se vším obsahem
// pohromadě (technologie + návod), ať appka samotná má co nejvíc místa.
function InfoButtonAndSheet() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.infoButton} onPress={() => setIsOpen(true)}>
        <Text style={styles.infoButtonText}>ⓘ</Text>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsOpen(false)} />
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <BrandHeader />
              <View style={{ marginTop: 24 }}>
                <TechSection />
              </View>
              <View style={{ marginTop: 28 }}>
                <TipsSection />
              </View>
            </ScrollView>
            <Pressable style={styles.sheetCloseButton} onPress={() => setIsOpen(false)}>
              <Text style={styles.sheetCloseButtonText}>Zavřít</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const isPhoneWidth = width <= PHONE_MAX_WIDTH;
  const isWideWidth = width >= WIDE_MIN_WIDTH;
  const showFrame = isWeb && !isPhoneWidth;
  const showSidePanels = isWeb && isWideWidth;
  const showInfoButton = isWeb && isPhoneWidth;

  const content = (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );

  // Na nativním telefonu (skutečná appka nainstalovaná z App Store/Google
  // Play, ne web v prohlížeči) appka vždy zabírá celou obrazovku - žádné
  // z tohohle se jí netýká.
  if (!isWeb) {
    return content;
  }

  // Na webu, ale v úzkém okně (typicky mobilní prohlížeč) - appka přes
  // celou obrazovku, žádný dekorativní rámeček, jen plovoucí info tlačítko.
  if (!showFrame) {
    return (
      <View style={styles.phoneFullBleed}>
        {content}
        {showInfoButton && <InfoButtonAndSheet />}
      </View>
    );
  }

  return (
    <View style={styles.webOuter}>
      <View style={styles.webRow}>
        {showSidePanels && <LeftPanel />}
        <View style={styles.webPhoneBox}>{content}</View>
        {showSidePanels && <RightPanel />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  phoneFullBleed: {
    flex: 1,
    backgroundColor: '#000000',
  },
  infoButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  infoButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  sheetCloseButton: {
    marginTop: 20,
    backgroundColor: '#CCFF00',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetCloseButtonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 15,
  },
  webOuter: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
    maxWidth: 1400,
    width: '100%',
  },
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
    flexShrink: 0,
  },
  sidePanel: {
    flex: 1,
    maxWidth: 280,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
  },
  brandSlogan: {
    color: '#9CA3AF',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
  sectionHeading: {
    color: '#CCFF00',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  techRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techBadge: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  techBadgeText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  tipNumber: {
    color: '#CCFF00',
    fontSize: 16,
    fontWeight: '800',
    width: 20,
  },
  tipText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});
