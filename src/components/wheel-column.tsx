import { useEffect, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export const WHEEL_ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5; // liché číslo, aby byla jedna položka přesně uprostřed
const CYCLE_REPEATS = 21; // kolikrát se seznam položek zopakuje za sebou (jen pro cyclic=true)

type WheelColumnProps = {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: number;
  // cyclic = true: seznam se "nekonečně" otáčí dokola (např. měsíce - po prosinci
  // zase leden). cyclic = false: seznam má pevný začátek a konec (např. roky).
  cyclic?: boolean;
};

export function WheelColumn({ items, selectedIndex, onChange, width, cyclic = false }: WheelColumnProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const paddingVertical = WHEEL_ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

  // V cyclic módu vykreslíme seznam vícekrát za sebou (např. leden..prosinec,
  // leden..prosinec, leden..prosinec, ...) a uživatel se pohybuje uprostřed
  // téhle dlouhé pásky - takže má pocit nekonečného otáčení, i když má technicky
  // začátek a konec (jen hodně daleko od místa, kde se zrovna dívá).
  const displayItems = cyclic
    ? Array.from({ length: items.length * CYCLE_REPEATS }, (_, i) => items[i % items.length])
    : items;

  const middleRepeatStart = cyclic ? Math.floor(CYCLE_REPEATS / 2) * items.length : 0;

  function extendedIndexFor(actualIndex: number) {
    return middleRepeatStart + actualIndex;
  }

  // Když se zvenčí změní počet položek (např. únor má míň dní než leden),
  // posuneme kolečko na platnou pozici uprostřed pásky.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: extendedIndexFor(selectedIndex) * WHEEL_ITEM_HEIGHT, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y;
    const rawIndex = Math.round(y / WHEEL_ITEM_HEIGHT);
    const clampedIndex = Math.min(Math.max(rawIndex, 0), displayItems.length - 1);
    const actualIndex = clampedIndex % items.length;
    onChange(actualIndex);

    if (cyclic) {
      // "Nenápadně" (bez animace) přeskočíme zpátky doprostřed dlouhé pásky,
      // ať má uživatel pořád dost prostoru točit se dál libovolným směrem.
      scrollRef.current?.scrollTo({ y: extendedIndexFor(actualIndex) * WHEEL_ITEM_HEIGHT, animated: false });
    } else {
      scrollRef.current?.scrollTo({ y: clampedIndex * WHEEL_ITEM_HEIGHT, animated: true });
    }
  }

  function handleItemPress(extendedIndex: number) {
    const actualIndex = extendedIndex % items.length;
    onChange(actualIndex);
    scrollRef.current?.scrollTo({ y: extendedIndex * WHEEL_ITEM_HEIGHT, animated: true });
  }

  return (
    <View style={[styles.container, { height: WHEEL_ITEM_HEIGHT * VISIBLE_ITEMS, width }]}>
      <View
        pointerEvents="none"
        style={[
          styles.highlight,
          {
            top: WHEEL_ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
            height: WHEEL_ITEM_HEIGHT,
            backgroundColor: theme.backgroundElement,
          },
        ]}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={{ paddingVertical }}
        contentOffset={{ x: 0, y: extendedIndexFor(selectedIndex) * WHEEL_ITEM_HEIGHT }}>
        {displayItems.map((label, extendedIndex) => {
          const isSelected = extendedIndex % items.length === selectedIndex;
          return (
            <Pressable
              key={extendedIndex}
              onPress={() => handleItemPress(extendedIndex)}
              style={styles.item}>
              <ThemedText type={isSelected ? 'smallBold' : 'default'} themeColor={isSelected ? 'text' : 'textSecondary'}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  item: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 8,
  },
});
