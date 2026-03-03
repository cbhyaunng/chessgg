import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCheckoutSession,
  getBillingSubscription,
  getMe,
  loginWithGoogle,
  logoutAuth,
  refreshAuth,
  type AuthResponse,
} from "../lib/api";
import { clearAuthSession, loadAuthSession, saveAuthSession, type AuthSession } from "../lib/auth-session";
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

  useEffect(() => {
    const bootstrap = async () => {
      const saved = loadAuthSession();
      if (!saved) {
        setIsReady(true);
        return;
      }

      try {
        await getMe(saved.accessToken);
        setSession(saved);
        saveAuthSession(saved);
      } catch {
        try {
          const refreshed = await refreshAuth(saved.refreshToken);
          setSession(refreshed);
          saveAuthSession(refreshed);
        } catch {
          clearAuthSession();
          setSession(null);
        }
      } finally {
        setIsReady(true);
      }
    };

    void bootstrap();
  }, []);

  const handleGoogleLogin = useCallback(async (idToken: string) => {
    const next = await loginWithGoogle(idToken);
    setSession(next);
    saveAuthSession(next);
    setIsAuthModalOpen(false);
  }, []);

  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

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
