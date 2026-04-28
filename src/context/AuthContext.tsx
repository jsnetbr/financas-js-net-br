import { Session, User } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const timer = window.setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        if (!supabase) return "Configure o Supabase antes de entrar.";
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? "Nao foi possivel entrar. Confira email e senha." : null;
      },
      async signUp(email, password) {
        if (!supabase) return "Configure o Supabase antes de criar conta.";
        const { error } = await supabase.auth.signUp({ email, password });
        return error ? "Nao foi possivel criar a conta. Verifique os dados." : null;
      },
      async resetPassword(email) {
        if (!supabase) return "Configure o Supabase antes de recuperar a senha.";
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        return error ? "Nao foi possivel enviar o email de recuperacao." : null;
      },
      async signOut() {
        await supabase?.auth.signOut();
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa estar dentro de AuthProvider");
  }
  return context;
}
