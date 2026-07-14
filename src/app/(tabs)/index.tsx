import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { todayIso } from '@/lib/membership';

type ActiveMembership = {
  ends_on: string | null;
  membership_types: { name: string } | null;
};

export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [membership, setMembership] = useState<ActiveMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // useFocusEffect = znovu načte data pokaždé, když se uživatel na tuhle
  // záložku vrátí (např. po koupi nové permice v profilu chceme, aby se
  // tady rovnou projevila, ne až po ručním refreshi appky).
  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      async function loadActiveMembership() {
        if (!session) return;
        setIsLoading(true);

        // Místo "WHERE status = active" (což je zastaralý uložený text) se
        // ptáme přímo podle dat: permanentka platí, když už začala
        // (starts_on <= dnes) a ještě neskončila (ends_on >= dnes).
        const today = todayIso();
        const { data } = await supabase
          .from('memberships')
          .select('ends_on, membership_types(name)')
          .eq('user_id', session.user.id)
          .lte('starts_on', today)
          .gte('ends_on', today)
          .order('ends_on', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isCancelled) {
          setMembership(data as ActiveMembership | null);
          setIsLoading(false);
        }
      }

      loadActiveMembership();
      return () => {
        isCancelled = true;
      };
    }, [session])
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            IRONCORE GYM
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.slogan}>
            You've got to achieve failure
          </ThemedText>
        </ThemedView>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: Spacing.six }} color={theme.text} />
        ) : (
          <>
            <ThemedView style={styles.qrWrapper}>
              {/* Zakódujeme unikátní ID přihlášeného uživatele - to na
                  recepci later naskenují a spárují s jeho účtem. */}
              <QRCode value={session?.user.id ?? ''} size={220} />
            </ThemedView>

            {membership ? (
              <ThemedView style={[styles.statusBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">{membership.membership_types?.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Platí do {formatDate(membership.ends_on)}
                </ThemedText>

                {/* Zjednodušená náhrada push notifikace - skutečné push
                    notifikace nejdou v tomhle prostředí (web/Expo Go)
                    otestovat, takže místo nich appka rovnou zobrazí
                    varování, když permanentka brzo vyprší. */}
                {isExpiringSoon(membership.ends_on) && (
                  <ThemedText type="small" themeColor="danger" style={{ marginTop: Spacing.one, textAlign: 'center' }}>
                    {daysUntil(membership.ends_on!) === 0
                      ? '⚠️ Pozor, permanentka vyprší dnes!'
                      : `⚠️ Pozor, permanentka vyprší za ${daysUntilLabel(membership.ends_on!)}!`}
                  </ThemedText>
                )}
              </ThemedView>
            ) : (
              <ThemedView style={[styles.statusBox, styles.warningBox, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Nemáte aktivní permanentku</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
                  QR kód funguje jen s platnou permanentkou nebo jednorázovým vstupem.
                </ThemedText>
                <Pressable style={styles.buyButton} onPress={() => router.push('/buy-membership')}>
                  <ThemedText type="smallBold" themeColor="onAccent">
                    Koupit permanentku
                  </ThemedText>
                </Pressable>
              </ThemedView>
            )}

            <Pressable style={styles.classesButton} onPress={() => router.push('/classes')}>
              <ThemedText type="smallBold">Rezervovat lekci</ThemedText>
            </Pressable>
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('cs-CZ');
}

const EXPIRING_SOON_THRESHOLD_DAYS = 3;

function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isExpiringSoon(isoDate: string | null): boolean {
  if (!isoDate) return false;
  const days = daysUntil(isoDate);
  return days >= 0 && days <= EXPIRING_SOON_THRESHOLD_DAYS;
}

// České skloňování slova "den" podle počtu - čeština má na rozdíl od
// angličtiny 3 tvary (1 den, 2-4 dny, 0/5+ dní), ne jen jednotné/množné číslo.
function daysUntilLabel(isoDate: string): string {
  const days = daysUntil(isoDate);
  if (days === 0) return 'dnes';
  if (days === 1) return '1 den';
  if (days >= 2 && days <= 4) return `${days} dny`;
  return `${days} dní`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
    letterSpacing: 3,
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  slogan: {
    marginTop: Spacing.one,
    fontStyle: 'italic',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  qrWrapper: {
    padding: Spacing.four,
    backgroundColor: '#ffffff',
    borderRadius: Spacing.three,
  },
  statusBox: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    alignSelf: 'stretch',
  },
  warningBox: {
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: Colors.light.accent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.one,
  },
  classesButton: {
    borderWidth: 1,
    borderColor: '#D0D2D8',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
});
