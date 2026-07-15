import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// Sem uživatele přivede odkaz z potvrzovacího e-mailu po registraci.
// Musí být dostupná i BEZ přihlášení (viz _layout.tsx, mimo Stack.Protected) -
// v momentě příchodu ještě žádnou platnou session nemá.
export default function ConfirmEmailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function exchangeCode() {
      if (!params.code) {
        setError('Odkaz je neplatný nebo mu chybí potřebné údaje.');
        return;
      }

      // Stejný princip jako u reset hesla - vyměníme jednorázový kód
      // z e-mailového odkazu za platnou session.
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);

      if (error) {
        setError('Odkaz už není platný (možná byl použitý, nebo mu vypršela platnost).');
        return;
      }

      // Jakmile je session platná, Stack.Protected v root layoutu sám
      // přesměruje do hlavní appky.
      router.replace('/');
    }

    exchangeCode();
  }, [params.code]);

  if (error) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four }}>
        <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
          {error}
        </ThemedText>
        <Pressable style={styles.button} onPress={() => router.replace('/login')}>
          <ThemedText type="smallBold" themeColor="onAccent">
            Zpět na přihlášení
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.text} />
      <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.three }}>
        Potvrzujeme e-mail…
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: Spacing.four,
    backgroundColor: '#CCFF00',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
});
