"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/services/api";

const StaffAuthContext = createContext(null);

export function StaffAuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const authVersion = useRef(0);

  const refreshUser = useCallback(async () => {
    const version = authVersion.current;

    try {
      const data = await apiFetch("/auth/me");

      if (version !== authVersion.current) return null;

      setUser(data.user);
      return data.user;
    } catch {
      if (version !== authVersion.current) return null;

      setUser(null);
      return null;
    } finally {
      if (version === authVersion.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  async function login(email, password) {
    const version = ++authVersion.current;

    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (version === authVersion.current) {
      setUser(data.user);
    }

    return data.user;
  }

  async function register(email, password) {
    const version = ++authVersion.current;

    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (version === authVersion.current) {
      setUser(data.user);
    }

    return data.user;
  }

  async function logout() {
    ++authVersion.current;
    setUser(null);
    setLoading(false);

    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <StaffAuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const context = useContext(StaffAuthContext);

  if (!context) {
    throw new Error(
      "useStaffAuth must be used inside StaffAuthProvider"
    );
  }

  return context;
}
