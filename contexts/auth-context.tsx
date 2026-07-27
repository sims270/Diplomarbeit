import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "boss" | "driver";

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  token: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    username: string,
    password: string,
    rememberMe: boolean,
  ) => Promise<LoginResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock validation - replace with backend API call later
const validateCredentials = async (
  username: string,
  password: string,
): Promise<LoginResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock credentials for testing
  const mockUsers: Record<string, { password: string; user: User }> = {
    boss: {
      password: "boss123",
      user: {
        id: "1",
        username: "boss",
        name: "Boss User",
        role: "boss",
        token: `token_boss_${Date.now()}`,
      },
    },
    driver: {
      password: "driver123",
      user: {
        id: "2",
        username: "driver",
        name: "Driver User",
        role: "driver",
        token: `token_driver_${Date.now()}`,
      },
    },
  };

  const mockUser = mockUsers[username];
  if (mockUser && mockUser.password === password) {
    return {
      success: true,
      user: mockUser.user,
    };
  }

  return {
    success: false,
    error: "Invalid username or password",
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for stored token on app start
  useEffect(() => {
    const checkStoredAuth = async () => {
      try {
        // Try SecureStore first (native), fall back to AsyncStorage (web)
        let storedToken = null as string | null;
        try {
          storedToken = await SecureStore.getItemAsync("authToken");
        } catch (e) {
          // SecureStore may not be available on web; ignore
          storedToken = null;
        }

        if (!storedToken) {
          storedToken = await AsyncStorage.getItem("authToken");
        }

        const storedUsername = await AsyncStorage.getItem("authUsername");

        if (storedToken && storedUsername) {
          // Validate stored token and retrieve user data
          // For now, just reconstruct user from stored data
          // In production, validate token with backend
          const userRole = storedUsername === "boss" ? "boss" : "driver";
          const userNames: Record<string, string> = {
            boss: "Boss User",
            driver: "Driver User",
          };

          setUser({
            id: userRole === "boss" ? "1" : "2",
            username: storedUsername,
            name: userNames[storedUsername] || storedUsername,
            role: userRole,
            token: storedToken,
          });
        }
      } catch (error) {
        console.error("Error checking stored auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkStoredAuth();
  }, []);

  const login = async (
    username: string,
    password: string,
    rememberMe: boolean,
  ): Promise<LoginResponse> => {
    setIsLoading(true);
    try {
      const result = await validateCredentials(username, password);

      if (result.success && result.user) {
        setUser(result.user);

        // Persist token and username so a reload keeps the user logged in.
        // Store in both SecureStore (native) and AsyncStorage (web) for cross-platform reliability.
        try {
          await SecureStore.setItemAsync("authToken", result.user.token);
        } catch (e) {
          // ignore if SecureStore not available
        }
        await AsyncStorage.setItem("authToken", result.user.token);
        await AsyncStorage.setItem("authUsername", result.user.username);

        return {
          success: true,
          user: result.user,
        };
      }

      return {
        success: false,
        error: result.error,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      setUser(null);
      try {
        await SecureStore.deleteItemAsync("authToken");
      } catch (e) {
        // ignore if not available
      }
      await AsyncStorage.removeItem("authToken");
      await AsyncStorage.removeItem("authUsername");
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
