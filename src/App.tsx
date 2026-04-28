import { AuthScreen } from "./components/AuthScreen";
import { FinanceDashboard } from "./components/FinanceDashboard";
import { LoadingLogo } from "./components/LoadingLogo";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./styles.css";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="loading-page">
        <LoadingLogo label="Abrindo suas financas..." />
      </main>
    );
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
