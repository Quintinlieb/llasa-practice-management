import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, type Location } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import DashboardLayout from "./components/DashboardLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ClientsTwo from "./pages/clientsTwo";
import Documents from "./pages/Documents";
import Matters from "./pages/Matters";
import CodeOfConductPreviewPage from "./pages/documents/discipline/CodeOfConductPreview";
import AddendumGenerator from "./pages/AddendumGenerator";
import TemporaryContractGenerator from "./pages/TemporaryContractGenerator";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import TermsAndConditions from "./pages/TermsAndConditions";

const queryClient = new QueryClient();

const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <Navigate to={user ? "/clients-2" : "/auth?login=1"} replace />;
};

const ProtectedAppShell = () => (
  <ProtectedRoute>
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  </ProtectedRoute>
);

const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = routeState?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation ?? location}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/landing" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedAppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients-2" element={<ClientsTwo />} />
          <Route path="/clients" element={<Navigate to="/clients-2" replace />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/case-files" element={<Matters />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="/employees" element={<Navigate to="/clients-2" replace />} />
        <Route path="/documents/discipline/code-of-conduct/preview" element={<ProtectedRoute><CodeOfConductPreviewPage /></ProtectedRoute>} />
        <Route path="/documents/discipline" element={<ProtectedRoute><Navigate to="/documents" replace /></ProtectedRoute>} />
        <Route path="/documents/performance" element={<ProtectedRoute><Navigate to="/documents" replace /></ProtectedRoute>} />
        <Route path="/documents/notices" element={<ProtectedRoute><Navigate to="/documents" replace /></ProtectedRoute>} />
        <Route path="/documents/contracts" element={<ProtectedRoute><Navigate to="/documents" replace /></ProtectedRoute>} />
        <Route path="/documents/contracts/addendum" element={<ProtectedRoute><AddendumGenerator /></ProtectedRoute>} />
        <Route path="/documents/contracts/temporary" element={<ProtectedRoute><TemporaryContractGenerator /></ProtectedRoute>} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {backgroundLocation ? (
        <Routes>
          <Route
            path="/settings"
            element={<ProtectedRoute><Settings embedded onClose={() => navigate(-1)} /></ProtectedRoute>}
          />
        </Routes>
      ) : null}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
