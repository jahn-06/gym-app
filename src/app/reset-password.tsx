import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// Sem uživatele přivede odkaz z e-mailu (viz forgot-password.tsx).
// Tahle obrazovka musí být dostupná i BEZ přihlášení (viz _layout.tsx,
// kde je zapsaná mimo Stack.Protected) - v momentě příchodu totiž uživatel
// ještě není normálně přihlášený.
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();

  const [isExchanging, setIsExchanging] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function exchangeCode() {
      if (!params.code) {
        setLinkError('Odkaz je neplatný nebo mu chybí potřebné údaje.');
        setIsExchanging(false);
        return;
      }

      // Vyměníme jednorázový kód z e-mailového odkazu za dočasnou
      // "recovery" session - ta appce umožní změnit heslo, i když
      // uživatel jinak není normálně přihlášený.
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);

      if (error) {
        setLinkError('Odkaz už není platný (možná byl použitý, nebo mu vypršela platnost).');
      }
      setIsExchanging(false);
    }

    exchangeCode();
  }, [params.code]);

  async function handleSave() {
    setFormError(null);

    if (password.length < 6) {
      setFormError('Heslo musí mít alespoň 6 znaků.');
      return;
    }
    if (password !== passwordConfirm) {
      setFormError('Hesla se neshodují.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSaving(false);

    if (error) {
      setFormError('Uložení se nezdařilo, zkuste to prosím znovu.');
      return;
    }

    // Heslo je nastavené a appka nás už z předchozího kroku považuje za
    // přihlášené (recovery session se po updateUser stává plnohodnotnou).
    // Root layout (Stack.Protected) nás sám přesměruje do hlavní appky.
    router.replace('/');
  }

  if (isExchanging) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.text} />
      </ThemedView>
    );
  }

  if (linkError) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four }}>
        <ThemedText type="smallBold" style={{ textAlign: 'center' }}>
          {linkError}
        </ThemedText>
        <Pressable style={styles.button} onPress={() => router.replace('/forgot-password')}>
          <ThemedText type="smallBold" themeColor="onAccent">
            Vyžádat nový odkaz
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={{ textAlign: 'center' }}>
          Nové heslo
        </ThemedText>

        <ThemedView style={styles.form}>
          <TextInput
            placeholder="Nové heslo"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            placeholder="Nové heslo znovu"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholderTextColor={theme.textSecondary}
          />

          {formError && (
            <ThemedText type="small" themeColor="danger">
              {formError}
            </ThemedText>
          )}

          <Pressable
            onPress={handleSave}
            disabled={isSaving || !password || !passwordConfirm}
            style={[styles.button, (isSaving || !password || !passwordConfirm) && { opacity: 0.5 }]}>
            {isSaving ? (
              <ActivityIndicator color={Colors.light.onAccent} />
            ) : (
              <ThemedText type="smallBold" themeColor="onAccent">
                Uložit nové heslo
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  form: { gap: Spacing.three, marginTop: Spacing.four },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  button: {
    backgroundColor: Colors.light.accent,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
});
