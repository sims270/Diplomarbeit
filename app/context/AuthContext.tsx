import type { Session } from "@supabase/supabase-js";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import { emailToUsername, usernameToEmail } from "../../lib/username";

interface AuthResult {
  success: boolean;
  error?: string;
}

// App-level role. Supabase's own `User.role` is a JWT claim ("authenticated")
// and unrelated to this — our role lives in user_metadata instead.
export type UserRole = "boss" | "driver";

export interface AppUser {
  id: string;
  role: UserRole;
  name: string;
  username: string;
}

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore any existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Stay in sync with sign-in/sign-out/token refresh events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
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
        return { success: false, error: error.message };
      }

      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: toAppUser(session),
        isAuthenticated: !!session,
        isLoading,
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
