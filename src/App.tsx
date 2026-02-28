import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import CoursePage from "./pages/CoursePage";
import AssignmentsPage from "./pages/AssignmentsPage";
import QuizzesPage from "./pages/QuizzesPage";
import DiscussionsPage from "./pages/DiscussionsPage";
import CoachStudio from "./pages/CoachStudio";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
