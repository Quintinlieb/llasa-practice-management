import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, type Location } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ClientsTwo from "./pages/clientsTwo";
import Documents from "./pages/Documents";
import CaseFiles from "./pages/CaseFiles";
import CodeOfConductPreviewPage from "./pages/documents/discipline/CodeOfConductPreview";
import WarningGenerator from "./pages/WarningGenerator";
import PermanentContractGenerator from "./pages/PermanentContractGenerator";
import AddendumGenerator from "./pages/AddendumGenerator";
import TemporaryContractGenerator from "./pages/TemporaryContractGenerator";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import TermsAndConditions from "./pages/TermsAndConditions";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = routeState?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation ?? location}>
        <Route path="/" element={<Navigate to="/auth?login=1" replace />} />
        <Route path="/landing" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/clients-2" element={<ProtectedRoute><ClientsTwo /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Navigate to="/clients-2" replace /></ProtectedRoute>} />
        <Route path="/employees" element={<Navigate to="/clients-2" replace />} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/documents/discipline/code-of-conduct/preview" element={<ProtectedRoute><CodeOfConductPreviewPage /></ProtectedRoute>} />
        <Route path="/documents/discipline" element={<ProtectedRoute><Navigate to="/documents" replace /></ProtectedRoute>} />
        <Route path="/documents/performance" element={<ProtectedRoute><Navigate to="/documents" replace /></ProtectedRoute>} />
        <Route path="/documents/notices" element={<ProtectedRoute><Navigate to="/documents" replace /></ProtectedRoute>} />
        <Route path="/documents/contracts" element={<ProtectedRoute><Navigate to="/documents" replace /></ProtectedRoute>} />
        <Route path="/documents/discipline/warnings" element={<ProtectedRoute><WarningGenerator /></ProtectedRoute>} />
        <Route path="/documents/contracts/addendum" element={<ProtectedRoute><AddendumGenerator /></ProtectedRoute>} />
        <Route path="/documents/contracts/permanent" element={<ProtectedRoute><PermanentContractGenerator /></ProtectedRoute>} />
        <Route path="/documents/contracts/temporary" element={<ProtectedRoute><TemporaryContractGenerator /></ProtectedRoute>} />
        <Route path="/case-files" element={<ProtectedRoute><CaseFiles /></ProtectedRoute>} />
        <Route path="/warning-generator" element={<ProtectedRoute><WarningGenerator /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
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
