import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ban4life_token';

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(localStorage.getItem(STORAGE_KEY)));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const verifyToken = useCallback(async (tokenToVerify: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${tokenToVerify}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
        return;
      }

      const valid = await verifyToken(token);
      if (isMounted) {
        if (valid) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setIsAuthenticated(false);
        }
        setIsLoading(false);
      }
    };

    check();
    return () => {
      isMounted = false;
    };
  }, [token, verifyToken]);

  const login = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      localStorage.setItem(STORAGE_KEY, data.token);
      setToken(data.token);
      setIsAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setIsAuthenticated(false);
  };

  return { token, isAuthenticated, isLoading, login, logout };
}
