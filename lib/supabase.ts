import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Make sure they are set in your .env file."
  );
}

// Localhost-Sperre: Im Entwicklungsmodus (npx expo start) darf die App nur
// mit dem Test-Projekt sprechen. Sonst landet ein lokaler Versuch, etwa ein
// Testauftrag oder eine Rechnung, im echten Betrieb und verbraucht dort
// Belegnummern. Fertige Builds (Vercel, Production wie Preview) haben
// __DEV__ = false und sind davon nicht betroffen. Die Ref ist öffentlich, sie
// steht ohnehin in jedem ausgelieferten Bundle. Siehe PLAN_TESTUMGEBUNG.md.
const TEST_PROJECT_REF = "xwygtudluxcxrdhupcfw";

if (__DEV__ && new URL(supabaseUrl).hostname !== `${TEST_PROJECT_REF}.supabase.co`) {
  throw new Error(
    "Lokal ist nur die Test-Datenbank erlaubt. In .env muss " +
      `EXPO_PUBLIC_SUPABASE_URL=https://${TEST_PROJECT_REF}.supabase.co stehen ` +
      "(Vorlage: .env.example). Danach mit `npx expo start -c` neu starten."
  );
}

// This app builds with `web.output: "static"`, so screens are pre-rendered
// server-side in Node before ever reaching a browser. AsyncStorage's web
// implementation reaches for `window.localStorage`, which doesn't exist in
// that Node context and would crash the whole client module on import.
// Route storage calls through a no-op during that SSR pass; once the page
// hydrates in an actual browser, `window` exists and AsyncStorage works
// exactly as documented. Native (iOS/Android) is unaffected either way.
const isServerSideRender = Platform.OS === "web" && typeof window === "undefined";

// Auch vom Offline-Fallback genutzt (lib/offlineFallback.ts wird über den
// AuthContext eingebunden), damit die SSR-Absicherung oben nur an einer
// Stelle steht.
export const authStorage = {
  getItem: (key: string) =>
    isServerSideRender ? Promise.resolve(null) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) =>
    isServerSideRender ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    isServerSideRender ? Promise.resolve() : AsyncStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
