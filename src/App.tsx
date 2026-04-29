import { AuthScreen } from "./components/AuthScreen";
import { FinanceDashboard } from "./components/FinanceDashboard";
import { LoadingLogo } from "./components/LoadingLogo";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./styles.css";

function AppContent() {
  const { recoveryMode, user, loading } = useAuth();

  if (loading) {
    return (
      <main className="loading-page">
        <LoadingLogo label="Abrindo suas financas..." />
      </main>
    );
  }

  if (recoveryMode) {
    return <AuthScreen />;
  }

  return user ? <FinanceDashboard /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
