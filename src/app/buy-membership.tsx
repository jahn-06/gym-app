import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DatePickerModal } from '@/components/date-picker-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { todayIso } from '@/lib/membership';
import { supabase } from '@/lib/supabase';

type MembershipType = {
  id: string;
  name: string;
  price_czk: number;
  duration_days: number | null;
};

export default function BuyMembershipScreen() {
  const theme = useTheme();
  const { session } = useAuth();

  const [types, setTypes] = useState<MembershipType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [minStartDate, setMinStartDate] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);

  // Při otevření obrazovky: 1) načteme ceník, 2) zjistíme, od kdy nejdřív
  // může začít NOVÁ souvislá permanentka (den po konci té poslední aktivní/
  // čekající - viz pravidlo "nová se řadí až po staré").
  useEffect(() => {
    async function load() {
      if (!session) return;
      setIsLoading(true);

      const [{ data: typesData }, { data: existingData }] = await Promise.all([
        supabase.from('membership_types').select('id, name, price_czk, duration_days').order('sort_order'),
        // Zajímá nás poslední permanentka, která ještě neskončila (podle
        // skutečného data, ne podle uloženého status textu) - jen taková
        // může blokovat začátek nové.
        supabase
          .from('memberships')
          .select('ends_on')
          .eq('user_id', session.user.id)
          .gte('ends_on', todayIso())
          .order('ends_on', { ascending: false })
          .limit(1),
      ]);

      const today = startOfToday();
      let earliestStart = today;

      if (existingData && existingData.length > 0 && existingData[0].ends_on) {
        const dayAfterLast = addDays(new Date(existingData[0].ends_on), 1);
        if (dayAfterLast > earliestStart) earliestStart = dayAfterLast;
      }

      setTypes(typesData ?? []);
      setSelectedTypeId(typesData?.[0]?.id ?? null);
      setMinStartDate(earliestStart);
      setStartDate(earliestStart);
      setIsLoading(false);
    }

    load();
  }, [session]);

  const selectedType = types.find((t) => t.id === selectedTypeId);
  const isSingleEntry = selectedType?.duration_days == null;

  function handleSelectType(type: MembershipType) {
    setSelectedTypeId(type.id);
    setDateError(null);
    // Jednorázový vstup nemá vazbu na předchozí permanentky - nejdřívější
    // možné datum je vždy dnešek. Předplatné respektuje frontu za starší permanentkou.
    const earliest = type.duration_days == null ? startOfToday() : minStartDate;
    setStartDate(earliest);
  }

  async function handlePay() {
    if (!session || !selectedType || !startDate) return;

    const earliestAllowed = isSingleEntry ? startOfToday() : minStartDate;
    if (startDate < earliestAllowed) {
      setDateError(`Nejdřívější možné datum je ${formatDisplayDate(earliestAllowed)}.`);
      return;
    }
    setDateError(null);
    setIsPaying(true);

    // MOCK PLATBA - žádná skutečná platební brána není napojená.
    // Simulujeme jen krátké čekání, ať to působí jako reálné zpracování.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const endsOn = selectedType.duration_days == null ? startDate : addDays(startDate, selectedType.duration_days);
    // "status" tady ukládáme jen jako informační snímek stavu v okamžiku
    // nákupu - appka se na něj nikde jinde nespoléhá (skutečnou platnost
    // vždy přepočítává z starts_on/ends_on, viz src/lib/membership.ts).
    const status = startDate <= startOfToday() ? 'active' : 'pending';

    const { data: inserted, error } = await supabase
      .from('memberships')
      .insert({
        user_id: session.user.id,
        membership_type_id: selectedType.id,
        starts_on: toIsoDate(startDate),
        ends_on: toIsoDate(endsOn),
        status,
      })
      .select('id')
      .single();

    setIsPaying(false);

    if (error || !inserted) {
      setDateError('Nákup se nezdařil, zkuste to prosím znovu.');
      return;
    }

    // Zavoláme databázovou funkci, která bezpečně (na serveru) vyhodnotí,
    // jestli je tenhle nákup nárok na referral odměnu (viz schema_referral.sql).
    const { data: rewardGranted } = await supabase.rpc('grant_referral_reward_if_eligible', {
      new_membership_id: inserted.id,
    });

    if (rewardGranted) {
      setRewardMessage('🎉 Díky doporučení jste vy i váš kamarád získali 5 dní navíc zdarma!');
    }

    setIsDone(true);
  }

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  if (isDone) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four }}>
        <ThemedText type="title" style={{ textAlign: 'center' }}>
          Hotovo!
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.two }}>
          {selectedType?.name} byla úspěšně zakoupena.
        </ThemedText>
        {rewardMessage && (
          <ThemedText type="smallBold" style={{ textAlign: 'center', marginTop: Spacing.three }}>
            {rewardMessage}
          </ThemedText>
        )}
        <Pressable style={styles.payButton} onPress={() => router.back()}>
          <ThemedText type="smallBold" themeColor="onAccent">
            Zpět na hlavní stránku
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ gap: Spacing.three }}>
          <ThemedText type="small" themeColor="textSecondary">
            Vyberte typ permanentky
          </ThemedText>

          {types.map((type) => {
            const isSelected = type.id === selectedTypeId;
            return (
              <Pressable
                key={type.id}
                onPress={() => handleSelectType(type)}
                style={[
                  styles.typeCard,
                  { backgroundColor: theme.backgroundElement },
                  isSelected && { borderColor: theme.accent, borderWidth: 2 },
                ]}>
                <ThemedView style={{ backgroundColor: 'transparent' }}>
                  <ThemedText type="smallBold">{type.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {type.duration_days ? `Platnost ${type.duration_days} dní` : 'Platí jeden den'}
                  </ThemedText>
                </ThemedView>
                <ThemedText type="smallBold">{type.price_czk} Kč</ThemedText>
              </Pressable>
            );
          })}

          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
            Od kdy má platit
          </ThemedText>
          <Pressable
            onPress={() => setIsDatePickerOpen(true)}
            style={[styles.input, styles.dateField, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText>{startDate ? formatDisplayDate(startDate) : 'Vyberte datum'}</ThemedText>
          </Pressable>
          {!isSingleEntry && (
            <ThemedText type="small" themeColor="textSecondary">
              Nejdřív od {formatDisplayDate(minStartDate)} (než doběhne případná stávající permanentka).
            </ThemedText>
          )}
          {dateError && (
            <ThemedText type="small" themeColor="danger">
              {dateError}
            </ThemedText>
          )}

          <Pressable
            onPress={handlePay}
            disabled={isPaying || !selectedType}
            style={[styles.payButton, isPaying && { opacity: 0.6 }]}>
            {isPaying ? (
              <ActivityIndicator color={Colors.light.onAccent} />
            ) : (
              <ThemedText type="smallBold" themeColor="onAccent">
                Zaplatit {selectedType ? `${selectedType.price_czk} Kč` : ''}
              </ThemedText>
            )}
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Toto je ukázková appka - platba je simulovaná, nedojde k žádnému skutečnému odečtení peněz.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>

      <DatePickerModal
        visible={isDatePickerOpen}
        initialDate={startDate}
        minDate={isSingleEntry ? startOfToday() : minStartDate}
        maxDate={addDays(startOfToday(), 365)}
        title="Od kdy má platit"
        onCancel={() => setIsDatePickerOpen(false)}
        onConfirm={(date) => {
          setStartDate(date);
          setDateError(null);
          setIsDatePickerOpen(false);
        }}
      />
    </ThemedView>
  );
}

// --- Pomocné funkce pro práci s daty ---

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('cs-CZ');
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    padding: Spacing.four,
  },
  typeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderColor: 'transparent',
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  dateField: {
    justifyContent: 'center',
  },
  payButton: {
    backgroundColor: Colors.light.accent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
