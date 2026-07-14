import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Animated, Easing, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { dateToIso } from '@/lib/membership';
import { supabase } from '@/lib/supabase';

type CheckIn = {
  id: string;
  checked_in_at: string;
};

type WeekCount = {
  weekStartIso: string;
  count: number;
  label: string;
};

// "Levely" streaku - čím delší streak, tím výraznější a "epičtější" odznak.
// Princip jako u Duolingo/herních achievementů: postupná eskalace ikony
// i barvy odměňuje za udržování série.
const STREAK_TIERS: {
  minStreak: number;
  icon: string;
  badgeSize: number;
  iconSize: number;
  numberSize: number;
  bg: string;
  text: string;
}[] = [
  { minStreak: 20, icon: '🏆', badgeSize: 132, iconSize: 46, numberSize: 32, bg: '#7C3AED', text: '#FFFFFF' },
  { minStreak: 16, icon: '🚀', badgeSize: 124, iconSize: 44, numberSize: 31, bg: '#F59E0B', text: '#431407' },
  { minStreak: 12, icon: '🚀', badgeSize: 116, iconSize: 42, numberSize: 30, bg: '#FBBF24', text: '#431407' },
  { minStreak: 9, icon: '✨', badgeSize: 108, iconSize: 40, numberSize: 28, bg: '#84CC16', text: '#1A2E05' },
  { minStreak: 7, icon: '⭐', badgeSize: 100, iconSize: 38, numberSize: 27, bg: '#A3E635', text: '#1A2E05' },
  { minStreak: 5, icon: '⚡', badgeSize: 94, iconSize: 36, numberSize: 26, bg: '#EAB308', text: '#422006' },
  { minStreak: 4, icon: '⚡', badgeSize: 88, iconSize: 34, numberSize: 25, bg: '#FACC15', text: '#422006' },
  { minStreak: 3, icon: '🔥', badgeSize: 82, iconSize: 32, numberSize: 24, bg: '#F97316', text: '#431407' },
  { minStreak: 2, icon: '🔥', badgeSize: 76, iconSize: 30, numberSize: 23, bg: '#FB923C', text: '#431407' },
  { minStreak: 1, icon: '🔥', badgeSize: 70, iconSize: 28, numberSize: 22, bg: '#FDBA74', text: '#431407' },
];

function StreakBadge({ streak, weeklyCounts }: { streak: number; weeklyCounts: WeekCount[] }) {
  const theme = useTheme();
  const tier = STREAK_TIERS.find((t) => streak >= t.minStreak);

// breatheAnim = velikost IKONKY v čase. Začíná rovnou na 1 (žádné
  // "vyskočení z ničeho"), a hned od začátku plynule pulzuje mezi
  // 90 % a 115 % velikosti - efekt "dýchání". Easing.inOut(Easing.sin)
  // zajišťuje, že zrychlování/zpomalování je hladké, ne trhané.
  const breatheAnim = useRef(new Animated.Value(1)).current;

useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.15,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0.97,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

return (
    <ThemedView style={styles.streakWrapper}>
<ThemedView
        style={[
          styles.streakBadge,
          {
            width: tier?.badgeSize ?? 64,
            height: tier?.badgeSize ?? 64,
            borderRadius: (tier?.badgeSize ?? 64) / 2,
            backgroundColor: tier?.bg ?? theme.background,
            borderWidth: tier ? 0 : 2,
            borderColor: theme.textSecondary,
            opacity: tier ? 1 : 0.5,
          },
        ]}>
        <Animated.View style={{ transform: [{ scale: breatheAnim }] }}>
          <ThemedText style={{ fontSize: tier?.iconSize ?? 24 }}>{tier?.icon ?? '🔥'}</ThemedText>
        </Animated.View>
        <ThemedText
          style={{
            fontSize: tier?.numberSize ?? 20,
            fontWeight: '800',
            color: tier?.text ?? theme.textSecondary,
            marginTop: 27,
          }}>
          {streak}
        </ThemedText>
      </ThemedView>

      <ThemedText themeColor="textSecondary" type="small" style={{ marginTop: Spacing.two, textAlign: 'center' }}>
        {streak === 0
          ? 'Začněte streak už tento týden!'
          : streak === 1
            ? 'týden v řadě aspoň s 1 vstupem'
            : 'týdny v řadě aspoň s 1 vstupem'}
      </ThemedText>

      <ThemedView style={styles.dotsRow}>
        {weeklyCounts.map((week, i) => {
          const isCurrentWeek = i === weeklyCounts.length - 1;
          const visited = week.count > 0;
          return (
            <ThemedView
              key={week.weekStartIso}
              style={[
                styles.dot,
                {
                  backgroundColor: visited ? theme.accent : 'transparent',
                  borderColor: visited ? theme.accent : theme.textSecondary,
                  borderWidth: isCurrentWeek ? 2 : 1,
                },
              ]}
            />
          );
        })}
      </ThemedView>
    </ThemedView>
  );
}

const WEEKS_IN_CHART = 12;
const BAR_MAX_HEIGHT = 200;
const PAGE_SIZE = 7; // kolik vstupů se zobrazí najednou / kolik se donačte při doscrollování

export default function HistoryScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      async function loadCheckIns() {
        if (!session) return;
        setIsLoading(true);

        const { data } = await supabase
          .from('check_ins')
          .select('id, checked_in_at')
          .eq('user_id', session.user.id)
          .order('checked_in_at', { ascending: false });

        if (!isCancelled) {
          setCheckIns(data ?? []);
          setVisibleCount(PAGE_SIZE);
          setIsLoading(false);
        }
      }

      loadCheckIns();
      return () => {
        isCancelled = true;
      };
    }, [session])
  );

  // Statistiky (streak + graf) počítáme z celého seznamu vstupů (i těch
  // zatím "neviditelných" pod stránkováním), aby byly vždy přesné.
  const { weeklyCounts, streak } = useMemo(() => computeWeeklyStats(checkIns), [checkIns]);
  const maxCount = Math.max(...weeklyCounts.map((w) => w.count), 1);

  const visibleCheckIns = checkIns.slice(0, visibleCount);
  const hasMore = visibleCount < checkIns.length;

  function handleLoadMore() {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    // Krátké umělé zpoždění - data už máme stažená všechna najednou, ale
    // takhle to působí jako plynulé donačítání, ne jako okamžitý "skok".
    setTimeout(() => {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, checkIns.length));
      setIsLoadingMore(false);
    }, 300);
  }

return (
    <ThemedView style={styles.container}>
      {/* SafeAreaView č.2 (VNĚJŠÍ) - obaluje úplně vše, řeší skutečné
          okraje obrazovky (nahoře, dole, po stranách) pro celý obsah. */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: Spacing.six }} color={theme.text} />
        ) : (
          <FlatList
            data={visibleCheckIns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: Spacing.two, paddingBottom: Spacing.six }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
              <>
                {/* SafeAreaView č.1 (VNITŘNÍ) - sekce "Historie vstupů":
                    nadpis + streak odznak + graf. Edges prázdné, protože
                    o skutečné okraje se stará ta vnější výše - tahle je
                    tu čistě jako logické seskupení. */}
                <SafeAreaView edges={[]}>
                  <ThemedText type="title" style={styles.title}>
                    Gym streak
                  </ThemedText>

                  <ThemedView style={[styles.statsCard, { backgroundColor: theme.backgroundElement }]}>
                    <StreakBadge streak={streak} weeklyCounts={weeklyCounts} />

                    <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.four }}>
                      Vstupy za posledních {WEEKS_IN_CHART} týdnů
                    </ThemedText>
                    <View style={styles.chartRow}>
                      {weeklyCounts.map((week, i) => {
                        const showLabel = i % 1 === 0 || i === weeklyCounts.length - 1;
                        return (
                          <View key={week.weekStartIso} style={styles.chartColumn}>
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.bar,
                                  {
                                    height: Math.max((week.count / maxCount) * BAR_MAX_HEIGHT, week.count > 0 ? 4 : 0),
                                    backgroundColor: theme.accent,
                                  },
                                ]}
                              />
                            </View>
                            <ThemedText type="small" themeColor="textSecondary" style={styles.chartLabel}>
                              {showLabel ? week.label : ''}
                            </ThemedText>
                          </View>
                        );
                      })}
                    </View>
                  </ThemedView>
                </SafeAreaView>

                {/* Nadpis patřící k sekci "tabulka jednotlivých vstupů" -
                    sedí hned nad řádky, které FlatList vykresluje níž. */}
                <ThemedText type="title" style={{ marginTop: Spacing.four }}>
                  Záznam tvých vstupů
                </ThemedText>
              </>
            }
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
                Zatím tu nemáte žádný zaznamenaný vstup.
              </ThemedText>
            }
            ListFooterComponent={
              isLoadingMore ? <ActivityIndicator style={{ marginTop: Spacing.three }} color={theme.text} /> : null
            }
            renderItem={({ item }) => {
              const { date, time } = formatDateTime(item.checked_in_at);
              return (
                <ThemedView style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{date}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {time}
                  </ThemedText>
                </ThemedView>
              );
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}


function formatDateTime(isoDate: string): { date: string; time: string } {
  const d = new Date(isoDate);
  return {
    date: d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }),
    time: d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
  };
}

// --- Statistiky: týdenní graf + streak ---

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Vrátí pondělí týdne, do kterého dané datum patří (český týden začíná
// pondělím, ne nedělí jako v USA).
function mondayOf(date: Date): Date {
  const d = startOfDay(date);
  const dayOfWeek = d.getDay(); // 0 = neděle, 1 = pondělí, ... 6 = sobota
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return addDays(d, diffToMonday);
}

function computeWeeklyStats(checkIns: CheckIn[]) {
  const thisMonday = mondayOf(new Date());

  // Kolik vstupů padlo do jakého týdne (klíč = pondělí toho týdne v ISO formátu).
  const countsByWeek = new Map<string, number>();
  for (const checkIn of checkIns) {
    const weekKey = dateToIso(mondayOf(new Date(checkIn.checked_in_at)));
    countsByWeek.set(weekKey, (countsByWeek.get(weekKey) ?? 0) + 1);
  }

  // Posledních N týdnů pro graf, seřazené od nejstaršího k nejnovějšímu.
const weeklyCounts = Array.from({ length: WEEKS_IN_CHART }, (_, i) => {
  const weeksAgo = WEEKS_IN_CHART - 1 - i;
  const weekStart = addDays(thisMonday, -weeksAgo * 7);
  const weekStartIso = dateToIso(weekStart);
  return {
    weekStartIso,
    count: countsByWeek.get(weekStartIso) ?? 0,
    label: i === WEEKS_IN_CHART - 1 ? 'Teď' : `W${i + 1}`,
  };
});

  // Streak: kolik týdnů v řadě má aspoň 1 vstup. Rozjetý (ještě neskončený)
  // aktuální týden bereme shovívavě - pokud v něm ještě nic není, prostě
  // začneme počítat od minulého týdne, ať appka streak neresetuje jen
  // proto, že jste dnes ještě nestihl dorazit.
  let cursor = thisMonday;
  if (!countsByWeek.has(dateToIso(cursor))) {
    cursor = addDays(cursor, -7);
  }
  let streak = 0;
  while (countsByWeek.has(dateToIso(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }

  return { weeklyCounts, streak };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  title: {},
  statsCard: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  streakWrapper: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  streakBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
    backgroundColor: 'transparent',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  chartRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartColumn: {
    alignItems: 'center',
    width: `${100 / WEEKS_IN_CHART}%`,
  },
  barTrack: {
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 35,
    borderRadius: 2,
  },
  chartLabel: {
    marginTop: Spacing.one,
    fontSize: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
});
