import { AuthScreen } from "./components/AuthScreen";
import { FinanceDashboard } from "./components/FinanceDashboard";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./styles.css";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <main className="loading-page">Carregando...</main>;
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
