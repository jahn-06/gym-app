import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
};

// Context = způsob, jak sdílet data (tady: přihlašovací session) napříč
// celou appkou, aniž bychom je museli ručně předávat z komponenty do
// komponenty. Kdokoliv v appce se pak zeptá "jsem přihlášený?" pomocí
// useAuth() a dostane aktuální odpověď.
const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Při startu appky zjistíme, jestli už existuje uložená (přihlášená)
    // session z minula (díky AsyncStorage, co jsme nastavili dřív).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // Posloucháme na změny přihlášení/odhlášení, ke kterým dojde kdykoliv
    // později (uživatel se přihlásí, odhlásí, token se obnoví...).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // "Cleanup" funkce - když se komponenta odpojí, přestaneme poslouchat,
    // abychom nezpůsobili únik paměti.
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading }}>{children}</AuthContext.Provider>
  );
}

// Vlastní "hook" - zkratka, aby kdekoliv v appce stačilo napsat
// `const { session } = useAuth();` místo importování celého Contextu.
export function useAuth() {
  return useContext(AuthContext);
}
