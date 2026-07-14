import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  async function handleLogin() {
    setErrorMessage(null);
    setIsLoading(true);

    // signInWithPassword = zavolá Supabase Auth API, které ověří heslo
    // a vrátí buď platnou session (uloží se automaticky přes AsyncStorage),
    // nebo chybu (např. špatné heslo).
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setIsLoading(false);

    if (error) {
      setErrorMessage(prelozitChybu(error.message));
      return;
    }

    // Nemusíme sami přesměrovávat na hlavní appku - AuthProvider zachytí
    // změnu session a Stack.Protected v root layoutu to udělá za nás.
  }

  async function handleDemoLogin() {
    setErrorMessage(null);
    setIsDemoLoading(true);

    const demoEmail = process.env.EXPO_PUBLIC_DEMO_EMAIL;
    const demoPassword = process.env.EXPO_PUBLIC_DEMO_PASSWORD;

    if (!demoEmail || !demoPassword) {
      setIsDemoLoading(false);
      setErrorMessage('Demo účet není nastavený.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
    setIsDemoLoading(false);

    if (error) {
      setErrorMessage('Přihlášení demo účtu se nezdařilo.');
    }
    // Stejně jako u handleLogin - přesměrování řeší AuthProvider automaticky.
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Vítejte zpět
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Přihlaste se do svého fitness účtu
        </ThemedText>

        <ThemedView style={styles.form}>
          <TextInput
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            placeholder="Heslo"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholderTextColor={theme.textSecondary}
          />

          {errorMessage && (
            <ThemedText themeColor="danger" type="small">
              {errorMessage}
            </ThemedText>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={isLoading || !email || !password}
            style={[styles.button, (isLoading || !email || !password) && styles.buttonDisabled]}>
            {isLoading ? (
              <ActivityIndicator color={Colors.light.onAccent} />
            ) : (
              <ThemedText type="smallBold" themeColor="onAccent">
                Přihlásit se
              </ThemedText>
            )}
          </Pressable>

          <Link href="/forgot-password" style={{ alignSelf: 'center', marginTop: Spacing.one }}>
            <ThemedText type="link" themeColor="textSecondary">
              Zapomenuté heslo?
            </ThemedText>
          </Link>
        </ThemedView>

        <Pressable onPress={handleDemoLogin} disabled={isDemoLoading} style={styles.demoButton}>
          {isDemoLoading ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <ThemedText type="smallBold">Vyzkoušet demo účet</ThemedText>
          )}
        </Pressable>

        <ThemedView style={styles.footer}>
          <ThemedText type="default" themeColor="textSecondary">
            Nemáte ještě účet?
          </ThemedText>
          <Link href="/register" replace>
            <ThemedText type="linkPrimary">Zaregistrujte se</ThemedText>
          </Link>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

// Supabase vrací chybové hlášky v angličtině - přeložíme aspoň ty
// nejčastější, ať uživatel rozumí, co je špatně.
function prelozitChybu(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Nesprávný e-mail nebo heslo.';
  }
  if (message.includes('Email not confirmed')) {
    return 'E-mail zatím nebyl potvrzen. Zkontrolujte schránku.';
  }
  return message;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D2D8',
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
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  demoButton: {
    borderWidth: 1,
    borderColor: '#D0D2D8',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.five,
  },
});
