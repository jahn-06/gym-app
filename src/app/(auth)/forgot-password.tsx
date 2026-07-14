import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleSubmit() {
    setMessage(null);
    setIsLoading(true);

    // Linking.createURL sestaví správnou "návratovou" adresu podle toho,
    // kde appka zrovna běží - na webu to bude např. http://localhost:8081/reset-password,
    // v nativní appce speciální odkaz začínající "fitnessapp://".
    const redirectTo = Linking.createURL('/reset-password');

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setIsLoading(false);

    if (error) {
      setMessage({ text: 'Něco se nepovedlo, zkuste to prosím znovu.', isError: true });
      return;
    }

    // Z bezpečnostních důvodů Supabase vždy odpoví úspěchem, i když e-mail
    // v systému vůbec neexistuje - jinak by šlo appku zneužít ke zjišťování,
    // které e-maily mají u nás založený účet.
    setMessage({
      text: 'Pokud je e-mail zaregistrovaný, poslali jsme na něj odkaz pro obnovení hesla.',
      isError: false,
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Zapomenuté heslo
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Zadejte e-mail a pošleme vám odkaz pro nastavení nového hesla
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

          {message && (
            <ThemedText type="small" themeColor={message.isError ? 'danger' : 'text'}>
              {message.text}
            </ThemedText>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={isLoading || !email}
            style={[styles.button, (isLoading || !email) && styles.buttonDisabled]}>
            {isLoading ? (
              <ActivityIndicator color={Colors.light.onAccent} />
            ) : (
              <ThemedText type="smallBold" themeColor="onAccent">
                Odeslat odkaz
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.footer}>
          <Link href="/login" replace>
            <ThemedText type="linkPrimary">Zpět na přihlášení</ThemedText>
          </Link>
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
    gap: Spacing.two,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.four },
  form: { gap: Spacing.three },
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
    marginTop: Spacing.two,
  },
  buttonDisabled: { opacity: 0.5 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.five,
  },
});
