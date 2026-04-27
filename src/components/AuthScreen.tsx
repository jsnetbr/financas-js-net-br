import { FormEvent, useState } from "react";
import { Landmark } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!email.includes("@") || password.length < 6) {
      setMessage("Use um email valido e senha com pelo menos 6 caracteres.");
      return;
    }

    setBusy(true);
    const error = mode === "login" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);

    if (error) {
      setMessage(error);
      return;
    }

    if (mode === "signup") {
      setMessage("Conta criada. Se o Supabase pedir confirmacao, veja seu email.");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-mark">
          <Landmark size={28} />
        </div>
        <h1>Financas pessoais</h1>
        <p>Controle entradas, saidas e contas fixas em um lugar simples.</p>

        {!isSupabaseConfigured && (
          <div className="notice">
            Configure o arquivo <strong>.env</strong> com as chaves do Supabase antes de entrar.
          </div>
        )}

        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Entrar
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Senha
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          {message && <p className="form-message">{message}</p>}
          <button className="primary-button" disabled={busy || !isSupabaseConfigured}>
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </section>
    </main>
  );
}
