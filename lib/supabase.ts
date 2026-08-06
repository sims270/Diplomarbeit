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

// This app builds with `web.output: "static"`, so screens are pre-rendered
// server-side in Node before ever reaching a browser. AsyncStorage's web
// implementation reaches for `window.localStorage`, which doesn't exist in
// that Node context and would crash the whole client module on import.
// Route storage calls through a no-op during that SSR pass; once the page
// hydrates in an actual browser, `window` exists and AsyncStorage works
// exactly as documented. Native (iOS/Android) is unaffected either way.
const isServerSideRender = Platform.OS === "web" && typeof window === "undefined";

const authStorage = {
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
