import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

// Speciální "vstupní bod" pro ukázky appky na portfoliu.
// Kdokoliv otevře adresu /demo, appka ho automaticky přihlásí pod
// předem připraveným demo účtem - nemusí nic vyplňovat.
// Odhlášením (v Profilu) se dostane na běžný login, kde si může
// založit svůj vlastní účet.
export default function DemoScreen() {
  const { session } = useAuth();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (session) return; // už přihlášený (např. reload stránky) - není co dělat

    const email = process.env.EXPO_PUBLIC_DEMO_EMAIL;
    const password = process.env.EXPO_PUBLIC_DEMO_PASSWORD;

    if (!email || !password) {
      console.warn('Chybí EXPO_PUBLIC_DEMO_EMAIL / EXPO_PUBLIC_DEMO_PASSWORD v .env');
      setAttempted(true);
      return;
    }

    supabase.auth.signInWithPassword({ email, password }).finally(() => setAttempted(true));
  }, [session]);

  // Jakmile jsme přihlášení, Stack.Protected v root layoutu nás sám
  // přesměruje do (tabs). Tohle je jen pojistka pro okamžitý přechod.
  if (session) {
    return <Redirect href="/" />;
  }

  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ThemedText type="default" themeColor="textSecondary">
        {attempted ? 'Přihlašování se nezdařilo.' : 'Načítání ukázky…'}
      </ThemedText>
    </ThemedView>
  );
}
