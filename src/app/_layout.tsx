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
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
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

      <Stack.Screen name="demo" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="confirm-email" />
    </Stack>
  );
}

// Poměr stran telefonu (šířka:výška) - reálný telefon je zhruba 9:19.5.
const PHONE_ASPECT = 9 / 19.5;

// Appka je "navržená" na téhle šířce (běžná šířka telefonu jako iPhone).
// Celý obsah appky vykreslíme na plátně přesně téhle velikosti a pak ho
// jako CELEK zmenšíme/zvětšíme (transform scale) na skutečnou velikost
// boxu - díky tomu se nic uvnitř appky nikdy nemačká ani nepřerovnává,
// jen se to zvětší/zmenší jako fotka.
const REFERENCE_WIDTH = 390;
const REFERENCE_HEIGHT = REFERENCE_WIDTH / PHONE_ASPECT;

const BOX_MAX_WIDTH = 420;
const GAP_BETWEEN_PANELS = 48;
const SIDE_PANEL_WIDTH = 280;
const WIDE_MIN_WIDTH = 1000; // od kdy je místo na postranní panely
const THIN_BORDER_BREAKPOINT = 640; // pod touhle šířkou je rámeček tenčí a okraje menší

const TECHS = ['React Native + Expo', 'TypeScript', 'Supabase', 'Expo Router'];
const TIPS = [
  'Přihlaste se přes připravený demo účet',
  'Prohlédněte si QR kód pro vstup do fitka',
  'Zarezervujte si lekci na domovské stránce',
  'Podívejte se na streak / statistiky / záznamy návštěvnosti',
  'V profil se podívejte na osobní údaje',
  'Kupte si permanentku a doporučte IRONCORE svým přátelům'
];

function BrandHeader() {
  return (
    <>
      <Text style={styles.brandTitle}>IRONCORE GYM</Text>
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
  const { width, height } = useWindowDimensions();

  const content = (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );

  if (Platform.OS !== 'web') {
    return content;
  }

  // Na webu appku obalíme vlastním SafeAreaProvider s PEVNĚ danými rozměry
  // (přesně velikost našeho "plátna" REFERENCE_WIDTH x REFERENCE_HEIGHT,
  // bez žádného odsazení). Bez tohohle by si appka počítala bezpečné
  // okraje (např. místo pro spodní lištu) podle SKUTEČNÉ velikosti okna
  // prohlížeče - což je při zmenšeném/zvětšeném plátně špatně a
  // způsobovalo to, že se spodní lišta "posunula" mimo viditelnou oblast.
const webContent = (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: REFERENCE_WIDTH, height: REFERENCE_HEIGHT },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <View style={styles.webContentPadding}>{content}</View>
    </SafeAreaProvider>
  );

  const showSidePanels = width >= WIDE_MIN_WIDTH;
  const isSmallScreen = width < THIN_BORDER_BREAKPOINT;

  // Na malé obrazovce chceme skoro žádný černý okraj (box ať využije
  // skoro celé okno), na velké necháváme štědřejší odstup.
  const outerPadding = isSmallScreen ? 8 : 24;

  const availableWidthForBox = showSidePanels
    ? width - outerPadding * 2 - GAP_BETWEEN_PANELS * 2 - SIDE_PANEL_WIDTH * 2
    : width - outerPadding * 2;
  const availableHeightForBox = height - outerPadding * 2;

  // Box musí zůstat v poměru 9:19.5 a vejít se zároveň na šířku i výšku -
  // vezmeme tu "přísnější" (menší) z obou možností.
  const widthLimitedByHeight = availableHeightForBox * PHONE_ASPECT;
  const boxWidth = Math.max(Math.min(BOX_MAX_WIDTH, availableWidthForBox, widthLimitedByHeight), 240);
  const boxHeight = boxWidth / PHONE_ASPECT;

  // Poměr, o kolik se plátno appky (390px) zvětší/zmenší, aby přesně
  // vyplnilo box. Např. box 300px široký -> scale 0.77 -> appka se
  // zobrazí jako zmenšená fotka sebe sama, ne přerovnaná/namačkaná.
  const scale = boxWidth / REFERENCE_WIDTH;

  const borderWidth = isSmallScreen ? 4 : 10;
  const borderRadius = isSmallScreen ? 24 : 44;

  return (
    <View style={[styles.webOuter, { padding: outerPadding }]}>
      <View style={styles.webRow}>
        {showSidePanels && <LeftPanel />}

        {/* phoneShell NEMÁ overflow:hidden - potřebujeme, aby postranní
            tlačítka mohla mírně přečnívat mimo okraj rámečku, aniž by se
            useřízla (to by se stalo, kdyby byla dovnitř webPhoneBox,
            který kvůli zaobleným rohům obrazovky overflow:hidden mít musí). */}
        <View style={[styles.phoneShell, { width: boxWidth, height: boxHeight }]}>
          <View
            style={[
              styles.webPhoneBox,
              { width: boxWidth, height: boxHeight, borderWidth, borderRadius },
            ]}>
            <View
              style={{
                width: REFERENCE_WIDTH,
                height: REFERENCE_HEIGHT,
                alignSelf: 'center',
                transform: [{ scale }],
                // @ts-expect-error transformOrigin je web-only vlastnost (funguje
                // díky react-native-web), TypeScript definice pro RN ji nezná.
                transformOrigin: 'top left',
              }}>
              {webContent}
            </View>

            {/* Dynamic Island - čistě dekorativní, škáluje se spolu s
                velikostí boxu (na malém boxu menší, na velkém větší). */}
            <View
              pointerEvents="none"
              style={[
                styles.dynamicIsland,
                {
                  width: 126 * scale,
                  height: 37 * scale,
                  borderRadius: 20 * scale,
                  top: 14 * scale,
                  marginLeft: (-126 * scale) / 2,
                },
              ]}
            />
          </View>

          {/* Postranní tlačítka - taky čistě dekorativní, poloha/velikost
              škálovaná stejným poměrem jako celý box. */}
          <View style={[styles.sideButtonRight, { width: 4 * scale, height: 70 * scale, top: 160 * scale, borderRadius: 2 * scale }]} />
          <View style={[styles.sideButtonLeft, { width: 4 * scale, height: 32 * scale, top: 120 * scale, borderRadius: 2 * scale }]} />
          <View style={[styles.sideButtonLeft, { width: 4 * scale, height: 60 * scale, top: 168 * scale, borderRadius: 2 * scale }]} />
        </View>

        {showSidePanels && <RightPanel />}
      </View>

      {!showSidePanels && <InfoButtonAndSheet />}
    </View>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GAP_BETWEEN_PANELS,
    maxWidth: 1400,
    width: '100%',
  },
  webPhoneBox: {
    borderColor: '#1a1a1a',
    overflow: 'hidden',
    backgroundColor: '#0B2A1E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 24,
    flexShrink: 0,
  },
  phoneShell: {
    position: 'relative',
    flexShrink: 0,
  },
  dynamicIsland: {
    position: 'absolute',
    left: '50%',
    backgroundColor: '#000000',
    zIndex: 10,
  },
  sideButtonRight: {
    position: 'absolute',
    right: -4,
    backgroundColor: '#1a1a1a',
  },
  sideButtonLeft: {
    position: 'absolute',
    left: -4,
    backgroundColor: '#1a1a1a',
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
  sidePanel: {
    flex: 1,
    maxWidth: SIDE_PANEL_WIDTH,
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
  webContentPadding: {
  flex: 1,
  paddingTop: 54,
  paddingLeft: 8.5,
  // paddingLeft/paddingRight sem klidně přidejte stejným způsobem,
  // až budete chtít doladit posun doleva/doprava
},
});
