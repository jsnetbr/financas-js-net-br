import { FormEvent, useState } from "react";
import { Landmark } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../lib/supabase";

type MessageTone = "info" | "success" | "error";

export function AuthScreen() {
  const { completePasswordRecovery, recoveryMode, resetPassword, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirm, setRecoveryConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);

  function showMessage(text: string, tone: MessageTone) {
    setMessage(text);
    setMessageTone(tone);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!email.includes("@") || password.length < 6) {
      showMessage("Use um email valido e senha com pelo menos 6 caracteres.", "error");
      return;
    }

    setBusy(true);
    const error = mode === "login" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);

    if (error) {
      showMessage(error, "error");
      return;
    }

    if (mode === "signup") {
      showMessage("Conta criada. Confira seu email se a confirmacao for solicitada.", "success");
    }
  }

  async function handlePasswordReset() {
    setMessage("");

    if (!email.includes("@")) {
      showMessage("Informe seu email para recuperar a senha.", "error");
      return;
    }

    setRecovering(true);
    const error = await resetPassword(email);
    setRecovering(false);
    showMessage(error ?? "Email de recuperacao enviado. Confira sua caixa de entrada.", error ? "error" : "success");
  }

  async function handleRecoverySubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (recoveryPassword.length < 6) {
      showMessage("A nova senha precisa ter pelo menos 6 caracteres.", "error");
      return;
    }

    if (recoveryPassword !== recoveryConfirm) {
      showMessage("A confirmacao da senha nao confere.", "error");
      return;
    }

    setBusy(true);
    const error = await completePasswordRecovery(recoveryPassword);
    setBusy(false);

    if (error) {
      showMessage(error, "error");
      return;
    }

    showMessage("Senha atualizada. Voce ja pode entrar normalmente.", "success");
    setRecoveryPassword("");
    setRecoveryConfirm("");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-mark">
          <Landmark size={28} />
        </div>
        <h1>{recoveryMode ? "Definir nova senha" : "Financas pessoais"}</h1>
        <p>
          {recoveryMode
            ? "Escolha a nova senha da sua conta para voltar ao app."
            : "Controle entradas, saidas e contas fixas em um lugar simples."}
        </p>

        {!isSupabaseConfigured && (
          <div className="notice">
            Configure o arquivo <strong>.env</strong> com as chaves do Supabase antes de entrar.
          </div>
        )}

        {recoveryMode ? (
          <form onSubmit={handleRecoverySubmit} className="auth-form">
            <label>
              Nova senha
              <input
                value={recoveryPassword}
                onChange={(event) => setRecoveryPassword(event.target.value)}
                type="password"
              />
            </label>
            <label>
              Confirmar senha
              <input
                value={recoveryConfirm}
                onChange={(event) => setRecoveryConfirm(event.target.value)}
                type="password"
              />
            </label>
            {message && <p className={`form-message ${messageTone}`}>{message}</p>}
            <button className="primary-button" disabled={busy || !isSupabaseConfigured}>
              {busy ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        ) : (
          <>
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
              {message && <p className={`form-message ${messageTone}`}>{message}</p>}
              <button className="primary-button" disabled={busy || !isSupabaseConfigured}>
                {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
              </button>
              {mode === "login" && (
                <button
                  className="link-button"
                  disabled={busy || recovering || !isSupabaseConfigured}
                  onClick={handlePasswordReset}
                  type="button"
                >
                  {recovering ? "Enviando..." : "Esqueci minha senha"}
                </button>
              )}
            </form>
          </>
        )}
      </section>
    </main>
  );
}
