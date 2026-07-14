import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WheelColumn } from '@/components/wheel-column';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MONTH_NAMES = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

type DatePickerModalProps = {
  visible: boolean;
  initialDate: Date | null;
  minDate: Date;
  maxDate: Date;
  title?: string;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
};

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

export function DatePickerModal({
  visible,
  initialDate,
  minDate,
  maxDate,
  title = 'Vyberte datum',
  onConfirm,
  onCancel,
}: DatePickerModalProps) {
  const theme = useTheme();

  const years = Array.from(
    { length: maxDate.getFullYear() - minDate.getFullYear() + 1 },
    (_, i) => minDate.getFullYear() + i
  );

  const fallback = clampDate(initialDate ?? new Date(), minDate, maxDate);
  const [day, setDay] = useState(fallback.getDate());
  const [month, setMonth] = useState(fallback.getMonth() + 1); // 1-12
  const [year, setYear] = useState(fallback.getFullYear());
  const [error, setError] = useState<string | null>(null);

  // Při každém otevření modalu resetujeme na aktuální/předvyplněnou hodnotu.
  useEffect(() => {
    if (visible) {
      const start = clampDate(initialDate ?? new Date(), minDate, maxDate);
      setDay(start.getDate());
      setMonth(start.getMonth() + 1);
      setYear(start.getFullYear());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const maxDayInSelectedMonth = daysInMonth(year, month);
  const days = Array.from({ length: maxDayInSelectedMonth }, (_, i) => i + 1);

  // Když přepnutím měsíce/roku vyjde den mimo platný rozsah (např. 31. únor),
  // srovnáme ho na poslední platný den daného měsíce.
  useEffect(() => {
    if (day > maxDayInSelectedMonth) {
      setDay(maxDayInSelectedMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  function handleConfirm() {
    const picked = new Date(year, month - 1, day);
    picked.setHours(0, 0, 0, 0);

    if (picked < startOf(minDate)) {
      setError(`Nejdřívější povolené datum je ${formatCz(minDate)}.`);
      return;
    }
    if (picked > startOf(maxDate)) {
      setError(`Nejpozdější povolené datum je ${formatCz(maxDate)}.`);
      return;
    }
    onConfirm(picked);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <ThemedView style={[styles.sheet, { backgroundColor: theme.background }]}>
          <ThemedText type="smallBold" style={{ textAlign: 'center', marginBottom: Spacing.two }}>
            {title}
          </ThemedText>

          <View style={styles.wheelsRow}>
            <WheelColumn
              key={`day-${visible}`}
              items={days.map(String)}
              selectedIndex={day - 1}
              onChange={(i) => setDay(days[i])}
              width={60}
              cyclic
            />
            <WheelColumn
              key={`month-${visible}`}
              items={MONTH_NAMES}
              selectedIndex={month - 1}
              onChange={(i) => setMonth(i + 1)}
              width={110}
              cyclic
            />
            <WheelColumn
              key={`year-${visible}`}
              items={years.map(String)}
              selectedIndex={years.indexOf(year)}
              onChange={(i) => setYear(years[i])}
              width={80}
            />
          </View>

          {error && (
            <ThemedText type="small" themeColor="danger" style={{ textAlign: 'center', marginTop: Spacing.one }}>
              {error}
            </ThemedText>
          )}

          <View style={styles.buttonsRow}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <ThemedText type="smallBold">Zrušit</ThemedText>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={handleConfirm}>
              <ThemedText type="smallBold" themeColor="onAccent">
                Potvrdit
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

function startOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < startOf(min)) return startOf(min);
  if (date > startOf(max)) return startOf(max);
  return date;
}

function formatCz(date: Date): string {
  return date.toLocaleDateString('cs-CZ');
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
  },
  wheelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#D0D2D8',
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.accent,
  },
});
