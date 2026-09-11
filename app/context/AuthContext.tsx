import type { Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  buildOfflineUser,
  matchesOfflineFallback,
} from "../../lib/offlineFallback";
import { authStorage, supabase } from "../../lib/supabase";
import { emailToUsername, usernameToEmail } from "../../lib/username";

// Schlüssel der lokal gespeicherten Offline-Sitzung. Bewusst getrennt von
// Supabases eigenem Session-Storage, damit beide sich nie ins Gehege kommen.
const OFFLINE_USER_KEY = "translogpro.offlineUser";

// Ist Supabase nicht erreichbar, kann das Wiederherstellen der Sitzung beim
// Erneuern eines abgelaufenen Tokens sehr lange dauern. Ohne Obergrenze
// bliebe die App im Ladezustand stehen — ausgerechnet in dem Fall, für den
// es den Offline-Login gibt.
const SESSION_RESTORE_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), SESSION_RESTORE_TIMEOUT_MS)
    ),
  ]);
}

interface AuthResult {
  success: boolean;
  error?: string;
  // True when the request never reached Supabase at all — device offline,
  // project paused, DNS/TLS failure. Callers show a "server unreachable"
  // message for these instead of blaming the entered credentials.
  isNetworkError?: boolean;
}

// App-level role. Supabase's own `User.role` is a JWT claim ("authenticated")
// and unrelated to this — our role lives in user_metadata instead.
export type UserRole = "boss" | "driver";

export interface AppUser {
  id: string;
  role: UserRole;
  name: string;
  username: string;
  // Der LKW, den der Chef diesem Fahrer zugeteilt hat (siehe
  // supabase/functions/create-driver). Optional: nicht jeder Fahrer hat
  // einen festen LKW, und die Offline-Sitzung kennt gar keinen.
  licensePlate?: string;
}

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // True, wenn die Anmeldung über den Offline-Fallback lief und damit kein
  // gültiges JWT existiert. Alles, was serverseitig geprüft wird (die
  // Fahrerverwaltung), funktioniert in diesem Zustand nicht.
  isOfflineMode: boolean;
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Every account's email is a synthetic `username@...` address we generate
// ourselves (see lib/username.ts) — so the email's local part IS the
// username, always. That's the single source of truth; we don't keep a
// separate copy in user_metadata that could drift out of sync.
function toAppUser(session: Session | null): AppUser | null {
  if (!session?.user) return null;
  const { id, email, user_metadata } = session.user;
  const username = email ? emailToUsername(email) : id;
  return {
    id,
    role: (user_metadata?.role as UserRole | undefined) ?? "driver",
    name: (user_metadata?.name as string | undefined) ?? username,
    username,
    licensePlate: (user_metadata?.license_plate as string | undefined) ?? '',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [offlineUser, setOfflineUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    // Restore any existing session on mount — echte Supabase-Sitzung und
    // eine eventuell hinterlegte Offline-Sitzung parallel, damit ein Reload
    // im Offline-Modus nicht zurück auf den Login wirft.
    const restore = async () => {
      const [restoredSession, storedOfflineUser] = await Promise.all([
        withTimeout(
          supabase.auth.getSession().then(({ data }) => data.session),
          null
        ),
        authStorage.getItem(OFFLINE_USER_KEY),
      ]);

      if (!isActive) return;

      setSession(restoredSession);

      // Eine echte Sitzung hat immer Vorrang: existiert sie, ist eine alte
      // Offline-Sitzung hinfällig.
      if (!restoredSession && storedOfflineUser) {
        try {
          setOfflineUser(JSON.parse(storedOfflineUser) as AppUser);
        } catch {
          // Unlesbarer Eintrag (z.B. aus einer älteren Version): verwerfen
          // statt die App daran scheitern zu lassen.
          authStorage.removeItem(OFFLINE_USER_KEY);
        }
      }

      setIsLoading(false);
    };

    restore();

    // Stay in sync with sign-in/sign-out/token refresh events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });

      if (error) {
        // auth-js wraps anything that never got an HTTP response — offline
        // client, paused project, DNS/TLS failure — as a retryable fetch
        // error with status 0. Its raw message is browser-specific
        // ("Failed to fetch" / "Load failed") and reads like a rejected
        // password, so we flag it instead of passing it to the UI verbatim.
        const isNetworkError =
          error.name === "AuthRetryableFetchError" || error.status === 0;

        // Nur hier — also wenn Supabase nachweislich nicht geantwortet hat —
        // darf der Offline-Fallback greifen. Bei einer echten Absage des
        // Servers ("Invalid login credentials") bleibt es beim Fehler.
        if (isNetworkError && matchesOfflineFallback(username, password)) {
          const fallbackUser = buildOfflineUser();
          await authStorage.setItem(
            OFFLINE_USER_KEY,
            JSON.stringify(fallbackUser)
          );
          setOfflineUser(fallbackUser);
          return { success: true };
        }

        return { success: false, error: error.message, isNetworkError };
      }

      // Echte Anmeldung geglückt: eine eventuell noch herumliegende
      // Offline-Sitzung ist damit überholt.
      await authStorage.removeItem(OFFLINE_USER_KEY);
      setOfflineUser(null);

      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authStorage.removeItem(OFFLINE_USER_KEY);
      setOfflineUser(null);
      await supabase.auth.signOut();
    } finally {
      setIsLoading(false);
    }
  };

  const sessionUser = toAppUser(session);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: sessionUser ?? offlineUser,
        isAuthenticated: !!session || !!offlineUser,
        isLoading,
        isOfflineMode: !session && !!offlineUser,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
