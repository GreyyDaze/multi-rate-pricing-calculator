"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type UserView } from "@/lib/api";

export function useSession() {
  const [user, setUser] = useState<UserView | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ user: UserView }>("/api/auth/me");
      setUser(res.user);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        setUser(null);
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function readSession() {
      try {
        const res = await api<{ user: UserView }>("/api/auth/me");
        if (!cancelled) {
          setUser(res.user);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
      }
    }
    void readSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, refresh };
}

export async function getSession(): Promise<UserView | null> {
  try {
    const res = await api<{ user: UserView }>("/api/auth/me");
    return res.user;
  } catch {
    return null;
  }
}