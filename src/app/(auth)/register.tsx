import * as Linking from 'expo-linking';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ ref?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [referralCode, setReferralCode] = useState(params.ref?.toUpperCase() ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    setErrorMessage(null);
    setInfoMessage(null);

    if (password !== passwordConfirm) {
      setErrorMessage('Hesla se neshodují.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Heslo musí mít alespoň 6 znaků.');
      return;
    }

    setIsLoading(true);

    // signUp vytvoří nový záznam v auth.users. Náš SQL trigger
    // "on_auth_user_created" (viz schema.sql + schema_referral.sql) se
    // automaticky postará o vytvoření řádku v tabulce profiles - a pokud
    // jsme mu přes "options.data" poslali referral kód, i o spárování
    // s tím, kdo nového uživatele pozval.
    //
    // emailRedirectTo výslovně řekne Supabase, kam má potvrzovací odkaz
    // v e-mailu vést - Linking.createURL to spočítá správně podle toho,
    // kde appka zrovna běží (lokálně i na ostré adrese na Renderu),
    // takže se to nespoléhá jen na "Site URL" nastavení v Supabase.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: Linking.createURL('/confirm-email'),
        data: referralCode ? { referral_code: referralCode.trim().toUpperCase() } : undefined,
      },
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(prelozitChybu(error.message));
      return;
    }

    // Podle nastavení Supabase projektu appka buď rovnou přihlásí
    // uživatele (data.session existuje), nebo vyžaduje potvrzení
    // e-mailu (data.session je null, dokud uživatel neklikne na odkaz
    // v e-mailu). Oba případy ošetříme.
    if (!data.session) {
      setInfoMessage('Registrace proběhla. Zkontrolujte e-mail a potvrďte účet.');
    }
    // Pokud session existuje, AuthProvider ji zachytí sám a appka
    // uživatele automaticky přesměruje do hlavní části.
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Vytvořit účet
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Založte si účet a získejte přístup do fitka
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
          <TextInput
            placeholder="Heslo znovu"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            placeholder="Kód od kamaráda (nepovinné)"
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholderTextColor={theme.textSecondary}
          />

          {errorMessage && (
            <ThemedText themeColor="danger" type="small">
              {errorMessage}
            </ThemedText>
          )}
          {infoMessage && (
            <ThemedText themeColor="text" type="small">
              {infoMessage}
            </ThemedText>
          )}

          <Pressable
            onPress={handleRegister}
            disabled={isLoading || !email || !password || !passwordConfirm}
            style={[
              styles.button,
              (isLoading || !email || !password || !passwordConfirm) && styles.buttonDisabled,
            ]}>
            {isLoading ? (
              <ActivityIndicator color={Colors.light.onAccent} />
            ) : (
              <ThemedText type="smallBold" themeColor="onAccent">
                Zaregistrovat se
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.footer}>
          <ThemedText type="default" themeColor="textSecondary">
            Už máte účet?
          </ThemedText>
          <Link href="/login" replace>
            <ThemedText type="linkPrimary">Přihlaste se</ThemedText>
          </Link>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

function prelozitChybu(message: string): string {
  if (message.includes('User already registered')) {
    return 'Tento e-mail už je zaregistrovaný.';
  }
  if (message.includes('Password should be at least')) {
    return 'Heslo je příliš krátké.';
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.five,
  },
});
