import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCheckoutSession,
  getBillingSubscription,
  getMe,
  loginWithSupabase,
  logoutAuth,
  refreshAuth,
  type AuthResponse,
} from "../lib/api";
import { clearAuthSession, loadAuthSession, saveAuthSession, type AuthSession } from "../lib/auth-session";
import { supabase } from "../lib/supabase";
import { AuthContext, type AuthContextValue } from "./auth-context";

function mergeSubscription(current: AuthSession, next: AuthResponse["subscription"]): AuthSession {
  return {
    ...current,
    subscription: next,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authReturnTo, setAuthReturnTo] = useState<string>("/");

  const currentPath = useCallback(() => {
    if (typeof window === "undefined") {
      return "/";
    }
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const saved = loadAuthSession();
        if (saved) {
          try {
            await getMe(saved.accessToken);
            setSession(saved);
            saveAuthSession(saved);
            return;
          } catch {
            try {
              const refreshed = await refreshAuth(saved.refreshToken);
              setSession(refreshed);
              saveAuthSession(refreshed);
              return;
            } catch {
              clearAuthSession();
              setSession(null);
            }
          }
        }

        if (supabase) {
          try {
            const { data, error } = await supabase.auth.getSession();
            if (!error && data.session?.access_token) {
              const exchanged = await loginWithSupabase(data.session.access_token);
              setSession(exchanged);
              saveAuthSession(exchanged);
            }
          } catch {
            clearAuthSession();
            setSession(null);
          }
        }
      } finally {
        setIsReady(true);
      }
    };

    void bootstrap();
  }, []);

  const handleGoogleLogin = useCallback(async (idToken: string) => {
    if (!supabase) {
      throw new Error("Supabase 설정이 필요합니다. VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 확인하세요.");
    }

    const loginResult = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (loginResult.error) {
      throw new Error(loginResult.error.message);
    }

    const accessToken = loginResult.data.session?.access_token;
    if (!accessToken) {
      throw new Error("Supabase access token을 가져오지 못했습니다.");
    }

    const next = await loginWithSupabase(accessToken);
    setSession(next);
    saveAuthSession(next);
    setIsAuthModalOpen(false);
    const now = currentPath();
    const destination = authReturnTo || "/";
    setAuthReturnTo(now);
    if (destination !== now && typeof window !== "undefined") {
      window.location.assign(destination);
    }
  }, [authReturnTo, currentPath]);

  const openAuthModal = useCallback(() => {
    setAuthReturnTo(currentPath());
    setIsAuthModalOpen(true);
  }, [currentPath]);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const logout = useCallback(async () => {
    if (session) {
      try {
        await logoutAuth(session.accessToken, session.refreshToken, true);
      } catch {
        // Ignore logout network errors and clear local session anyway.
      }
    }

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore Supabase sign-out errors and clear local session anyway.
      }
    }

    clearAuthSession();
    setSession(null);
  }, [session]);

  const refreshMe = useCallback(async () => {
    if (!session) {
      return;
    }

    const [me, subscription] = await Promise.all([getMe(session.accessToken), getBillingSubscription(session.accessToken)]);

    const next = mergeSubscription(
      {
        ...session,
        user: {
          id: me.user.id,
          email: me.user.email,
          role: me.user.role,
        },
      },
      {
        plan: subscription.plan,
        status: subscription.status,
        periodEnd: subscription.periodEnd,
      },
    );

    setSession(next);
    saveAuthSession(next);
  }, [session]);

  const startCheckout = useCallback(async () => {
    if (!session) {
      throw new Error("로그인이 필요합니다.");
    }

    const response = await createCheckoutSession(session.accessToken);
    if (!response.url) {
      throw new Error("Checkout URL을 받지 못했습니다.");
    }

    window.location.href = response.url;
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isReady,
      isAuthenticated: Boolean(session),
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      loginWithGoogle: handleGoogleLogin,
      logout,
      refreshMe,
      startCheckout,
    }),
    [
      session,
      isReady,
      isAuthModalOpen,
      openAuthModal,
      closeAuthModal,
      handleGoogleLogin,
      logout,
      refreshMe,
      startCheckout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
