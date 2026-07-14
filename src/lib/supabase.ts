import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Hodnoty se čtou z .env souboru (viz .env.example).
// Prefix "EXPO_PUBLIC_" je nutný - jen proměnné s tímto prefixem
// jsou dostupné v kódu appky, která běží na telefonu uživatele.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Expo Router na webu appku jednou "zkušebně" vykreslí i mimo prohlížeč
// (v Node.js), aby předpřipravil úvodní HTML. Tam ale neexistuje `window`,
// takže běžný AsyncStorage (který na webu interně používá window.localStorage)
// spadne. Tenhle adaptér operace bezpečně přeskočí, pokud window neexistuje,
// a jinak se chová úplně stejně jako normální AsyncStorage.
const safeStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Úložiště, kam se uloží přihlašovací token uživatele, aby se po
    // zavření appky nemusel znovu přihlašovat.
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
