import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import CoursePage from "./pages/CoursePage";
import AssignmentsPage from "./pages/AssignmentsPage";
import QuizzesPage from "./pages/QuizzesPage";
import DiscussionsPage from "./pages/DiscussionsPage";
import CoachStudio from "./pages/CoachStudio";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/course/:courseId" element={<CoursePage />} />
                      <Route path="/assignments" element={<AssignmentsPage />} />
                      <Route path="/quizzes" element={<QuizzesPage />} />
                      <Route path="/discussions" element={<DiscussionsPage />} />
                      <Route path="/coach-studio" element={<CoachStudio />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
