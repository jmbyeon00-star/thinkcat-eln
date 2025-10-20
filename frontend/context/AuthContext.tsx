"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type User = { id: number; email: string } | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  let fetching = false;

  // ✅ 앱 최초 로드 시 1회만 세션 확인
  const refreshUser = async () => {
    if (fetching) return;
    fetching = true;
    try {
      const data = await fetchWithAuth("/api/auth/me");
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      fetching = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const logout = async () => {
    try {
      await fetchWithAuth("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
