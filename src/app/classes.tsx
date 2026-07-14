import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { dateToIso } from '@/lib/membership';
import { supabase } from '@/lib/supabase';

const DAYS_AHEAD = 14; // jak daleko dopředu appka rozvrh počítá
const CANCEL_MIN_DAYS = 7; // musí zbývat aspoň tolik dní na zrušení

type ClassTemplate = {
  id: string;
  name: string;
  instructor: string | null;
  day_of_week: number; // 1 = pondělí ... 7 = neděle
  start_time: string; // "HH:MM:SS"
  duration_minutes: number;
  capacity: number;
};

type Booking = {
  id: string;
  class_id: string;
  user_id: string;
  class_date: string; // "YYYY-MM-DD"
};

type Occurrence = {
  key: string;
  classId: string;
  name: string;
  instructor: string | null;
  date: Date;
  dateIso: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  myBookingId: string | null;
};

export default function ClassesScreen() {
  const theme = useTheme();
  const { session } = useAuth();

  const [classTemplates, setClassTemplates] = useState<ClassTemplate[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyOccurrenceKey, setBusyOccurrenceKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);

    const today = dateToIso(new Date());
    const windowEnd = dateToIso(addDays(new Date(), DAYS_AHEAD));

    const [{ data: classesData }, { data: bookingsData }] = await Promise.all([
      supabase.from('classes').select('id, name, instructor, day_of_week, start_time, duration_minutes, capacity'),
      supabase
        .from('class_bookings')
        .select('id, class_id, user_id, class_date')
        .gte('class_date', today)
        .lte('class_date', windowEnd),
    ]);

    setClassTemplates(classesData ?? []);
    setBookings(bookingsData ?? []);
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Z týdenního vzoru (classTemplates) dopočítáme konkrétní termíny na
  // nejbližších DAYS_AHEAD dní, a ke každému spárujeme rezervace.
  const occurrences = useMemo<Occurrence[]>(() => {
    if (!session) return [];
    const result: Occurrence[] = [];

    for (let offset = 0; offset < DAYS_AHEAD; offset++) {
      const date = addDays(new Date(), offset);
      const isoDayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // JS neděle=0 -> náš formát 7
      const dateIso = dateToIso(date);

      for (const template of classTemplates) {
        if (template.day_of_week !== isoDayOfWeek) continue;

        const matchingBookings = bookings.filter(
          (b) => b.class_id === template.id && b.class_date === dateIso
        );
        const myBooking = matchingBookings.find((b) => b.user_id === session.user.id);

        result.push({
          key: `${template.id}-${dateIso}`,
          classId: template.id,
          name: template.name,
          instructor: template.instructor,
          date,
          dateIso,
          startTime: template.start_time.slice(0, 5), // "18:00:00" -> "18:00"
          durationMinutes: template.duration_minutes,
          capacity: template.capacity,
          bookedCount: matchingBookings.length,
          myBookingId: myBooking?.id ?? null,
        });
      }
    }

    result.sort((a, b) => (a.dateIso + a.startTime).localeCompare(b.dateIso + b.startTime));
    return result;
  }, [classTemplates, bookings, session]);

  const myOccurrences = occurrences.filter((o) => o.myBookingId);

  async function handleBook(occurrence: Occurrence) {
    if (!session) return;
    setActionMessage(null);
    setBusyOccurrenceKey(occurrence.key);

    const { error } = await supabase.from('class_bookings').insert({
      class_id: occurrence.classId,
      user_id: session.user.id,
      class_date: occurrence.dateIso,
    });

    setBusyOccurrenceKey(null);

    if (error) {
      setActionMessage('Rezervace se nezdařila (možná je lekce už plná).');
      return;
    }
    await loadData();
  }

  async function handleCancel(occurrence: Occurrence) {
    if (!occurrence.myBookingId) return;
    setActionMessage(null);

    const daysUntilClass = Math.floor((occurrence.date.getTime() - startOfToday().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilClass < CANCEL_MIN_DAYS) {
      setActionMessage(`Zrušit lze nejpozději ${CANCEL_MIN_DAYS} dní před konáním lekce.`);
      return;
    }

    setBusyOccurrenceKey(occurrence.key);
    const { error } = await supabase.from('class_bookings').delete().eq('id', occurrence.myBookingId);
    setBusyOccurrenceKey(null);

    if (error) {
      setActionMessage('Zrušení se nezdařilo.');
      return;
    }
    await loadData();
  }

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ gap: Spacing.three, paddingBottom: Spacing.six }}>
          {actionMessage && (
            <ThemedText type="small" themeColor="danger">
              {actionMessage}
            </ThemedText>
          )}

          {myOccurrences.length > 0 && (
            <>
              <ThemedText type="smallBold">Moje rezervace</ThemedText>
              {myOccurrences.map((occurrence) => (
                <ClassRow
                  key={occurrence.key}
                  occurrence={occurrence}
                  isBusy={busyOccurrenceKey === occurrence.key}
                  onBook={() => handleBook(occurrence)}
                  onCancel={() => handleCancel(occurrence)}
                />
              ))}
            </>
          )}

          <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
            Rozvrh na příštích {DAYS_AHEAD} dní
          </ThemedText>
          {occurrences.length === 0 ? (
            <ThemedText themeColor="textSecondary" type="small">
              Žádné lekce v tomto období.
            </ThemedText>
          ) : (
            occurrences.map((occurrence) => (
              <ClassRow
                key={occurrence.key}
                occurrence={occurrence}
                isBusy={busyOccurrenceKey === occurrence.key}
                onBook={() => handleBook(occurrence)}
                onCancel={() => handleCancel(occurrence)}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ClassRow({
  occurrence,
  isBusy,
  onBook,
  onCancel,
}: {
  occurrence: Occurrence;
  isBusy: boolean;
  onBook: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const isFull = occurrence.bookedCount >= occurrence.capacity && !occurrence.myBookingId;
  const spotsLeft = Math.max(occurrence.capacity - occurrence.bookedCount, 0);

  return (
    <ThemedView style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedView style={{ backgroundColor: 'transparent', flex: 1 }}>
        <ThemedText type="smallBold">{occurrence.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDayLabel(occurrence.date)} · {occurrence.startTime} · {occurrence.durationMinutes} min
        </ThemedText>
        {occurrence.instructor && (
          <ThemedText type="small" themeColor="textSecondary">
            {occurrence.instructor}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor={isFull ? 'danger' : 'textSecondary'}>
          {isFull ? 'Obsazeno' : `Volných míst: ${spotsLeft}/${occurrence.capacity}`}
        </ThemedText>
      </ThemedView>

      {isBusy ? (
        <ActivityIndicator color={theme.text} />
      ) : occurrence.myBookingId ? (
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <ThemedText type="small" themeColor="danger">
            Zrušit
          </ThemedText>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.bookButton, isFull && { opacity: 0.4 }]}
          onPress={onBook}
          disabled={isFull}>
          <ThemedText type="small" themeColor="onAccent">
            Rezervovat
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfToday(): Date {
  return addDays(new Date(), 0);
}

function formatDayLabel(date: Date): string {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  if (date.getTime() === today.getTime()) return 'Dnes';
  if (date.getTime() === tomorrow.getTime()) return 'Zítra';
  return date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    padding: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  bookButton: {
    backgroundColor: Colors.light.accent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.light.danger,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
