import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CompanySetup from "./pages/CompanySetup";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Documents from "./pages/Documents";
import DisciplineDocumentsPage from "./pages/documents/discipline/page";
import PerformanceDocumentsPage from "./pages/documents/performance/page";
import ContractsDocumentsPage from "./pages/documents/contracts/page";
import CodeOfConductPreviewPage from "./pages/documents/discipline/CodeOfConductPreview";
import WarningGenerator from "./pages/WarningGenerator";
import PermanentContractGenerator from "./pages/PermanentContractGenerator";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import CalendarPage from "./pages/Calendar";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/company-setup" element={<ProtectedRoute><CompanySetup /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/documents/discipline" element={<ProtectedRoute><DisciplineDocumentsPage /></ProtectedRoute>} />
            <Route path="/documents/discipline/code-of-conduct/preview" element={<ProtectedRoute><CodeOfConductPreviewPage /></ProtectedRoute>} />
            <Route path="/documents/performance" element={<ProtectedRoute><PerformanceDocumentsPage /></ProtectedRoute>} />
            <Route path="/documents/contracts" element={<ProtectedRoute><ContractsDocumentsPage /></ProtectedRoute>} />
            <Route path="/documents/discipline/warnings" element={<ProtectedRoute><WarningGenerator /></ProtectedRoute>} />
            <Route path="/documents/contracts/permanent" element={<ProtectedRoute><PermanentContractGenerator /></ProtectedRoute>} />
            <Route path="/warning-generator" element={<ProtectedRoute><WarningGenerator /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE - THE CATCH-ALL ROUTE IS LAST */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
