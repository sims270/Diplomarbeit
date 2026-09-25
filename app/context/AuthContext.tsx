import type { Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  buildOfflineUser,
  isOfflineFallbackConfigured,
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
// and unrelated to this — our role lives in public.profiles instead
// (supabase/migrations/20260915110000_create_profiles.sql). Nicht im
// user_metadata: das kann jeder Nutzer selbst ändern.
export type UserRole = "boss" | "driver" | "external_driver";

// Die Startseite je Rolle — Login und die Rollen-Guards in den Layouts
// leiten hierher.
export function homeRouteFor(role: UserRole): "/chef" | "/driver" | "/external" {
  switch (role) {
    case "boss":
      return "/chef";
    case "external_driver":
      return "/external";
    default:
      return "/driver";
  }
}

const NO_ROLE_MESSAGE = "Für dieses Konto ist kein Zugang eingerichtet.";

async function fetchRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as UserRole | undefined) ?? null;
}

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
//
// Ohne Rolle gibt es keinen Nutzer — bewusst kein stiller Rückfall auf
// "driver": ein Konto, das nirgends eingetragen ist, soll nirgends hinein.
function toAppUser(session: Session | null, role: UserRole | null): AppUser | null {
  if (!session?.user || !role) return null;
  const { id, email, user_metadata } = session.user;
  const username = email ? emailToUsername(email) : id;
  return {
    id,
    role,
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
  // Die Rolle gehört zu genau einem Konto. Solange sie für das aktuelle
  // Konto noch nicht geladen ist, gilt die App als "lädt".
  const [loadedRole, setLoadedRole] = useState<{
    userId: string;
    role: UserRole | null;
  } | null>(null);

  const sessionUserId = session?.user?.id ?? null;

  // Eigener Effekt statt im onAuthStateChange-Callback: supabase-js warnt
  // davor, dort weitere Supabase-Aufrufe abzuwarten.
  useEffect(() => {
    if (!sessionUserId) return;
    let isActive = true;

    fetchRole(sessionUserId)
      .then((role) => {
        if (!isActive) return;
        setLoadedRole({ userId: sessionUserId, role });
        // Angemeldet, aber ohne Rolle: abmelden, sonst hinge das Konto in
        // einem Zustand fest, in dem es weder hinein noch zum Login kommt.
        if (!role) supabase.auth.signOut();
      })
      .catch(() => {
        // Rolle nicht lesbar (etwa kein Netz): kein Zugang, aber auch kein
        // Abmelden — beim nächsten Start wird es erneut versucht.
        if (isActive) setLoadedRole({ userId: sessionUserId, role: null });
      });

    return () => {
      isActive = false;
    };
  }, [sessionUserId]);

  const isRoleLoading = !!sessionUserId && loadedRole?.userId !== sessionUserId;
  const role = sessionUserId && loadedRole?.userId === sessionUserId ? loadedRole.role : null;

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
      // Offline-Sitzung hinfällig. Ist der Fallback in diesem Build gar
      // nicht eingeschaltet, kann der Eintrag nur von Hand in den
      // localStorage geschrieben worden sein — dann zählt er nicht.
      if (!restoredSession && storedOfflineUser && !isOfflineFallbackConfigured()) {
        authStorage.removeItem(OFFLINE_USER_KEY);
      } else if (!restoredSession && storedOfflineUser) {
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
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
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

      // Richtiges Passwort, aber keine Rolle: sagen, woran es liegt, statt
      // kommentarlos auf dem Login stehen zu bleiben.
      if (signInData.user) {
        try {
          if (!(await fetchRole(signInData.user.id))) {
            await supabase.auth.signOut();
            return { success: false, error: NO_ROLE_MESSAGE };
          }
        } catch {
          // Netzfehler beim Lesen der Rolle: der Effekt oben versucht es
          // ohnehin noch einmal.
        }
      }

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

  const sessionUser = toAppUser(session, role);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: sessionUser ?? offlineUser,
        isAuthenticated: !!sessionUser || !!offlineUser,
        isLoading: isLoading || isRoleLoading,
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
