import { Redirect } from 'expo-router';

// Když nepřihlášený uživatel otevře appku, "/" ho automaticky
// přesměruje rovnou na přihlašovací obrazovku.
export default function AuthIndex() {
  return <Redirect href="/login" />;
}
