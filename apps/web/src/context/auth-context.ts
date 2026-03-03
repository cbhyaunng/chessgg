import { createContext } from "react";
import type { AuthSession } from "../lib/auth-session";

export type AuthContextValue = {
  session: AuthSession | null;
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  startCheckout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
