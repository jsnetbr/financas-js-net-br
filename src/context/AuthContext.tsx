import { Session, User } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  completePasswordRecovery: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setRecoveryMode(window.location.hash.includes("type=recovery"));
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setRecoveryMode(event === "PASSWORD_RECOVERY");
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      loading,
      recoveryMode,
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
          redirectTo: `${window.location.origin}/?reset=1`,
        });
        return error ? "Nao foi possivel enviar o email de recuperacao." : null;
      },
      async completePasswordRecovery(password) {
        if (!supabase) return "Configure o Supabase antes de atualizar a senha.";
        const { error } = await supabase.auth.updateUser({ password });
        if (!error) {
          setRecoveryMode(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        return error ? "Nao foi possivel definir a nova senha." : null;
      },
      async signOut() {
        setRecoveryMode(false);
        await supabase?.auth.signOut();
      },
    }),
    [loading, recoveryMode, session],
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
