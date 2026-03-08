import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleGuard from "./components/RoleGuard";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import CoursePage from "./pages/CoursePage";
import AssignmentsPage from "./pages/AssignmentsPage";
import AssignmentDetailPage from "./pages/AssignmentDetailPage";
import QuizzesPage from "./pages/QuizzesPage";
import DiscussionsPage from "./pages/DiscussionsPage";
import DiscussionThreadPage from "./pages/DiscussionThreadPage";
import CoachStudio from "./pages/CoachStudio";
import GradesPage from "./pages/GradesPage";
import CalendarPage from "./pages/CalendarPage";
import LessonPage from "./pages/LessonPage";
import GradingQueuePage from "./pages/GradingQueuePage";
import ProfilePage from "./pages/ProfilePage";
import AdminPanel from "./pages/AdminPanel";
import ParentPortal from "./pages/ParentPortal";
import MessagesPage from "./pages/MessagesPage";
import AuthPage from "./pages/AuthPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
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
                        <Route path="/assignment/:assignmentId" element={<AssignmentDetailPage />} />
                        <Route path="/quizzes" element={<QuizzesPage />} />
                        <Route path="/discussions" element={<DiscussionsPage />} />
                        <Route path="/discussion/:discussionId" element={<DiscussionThreadPage />} />
                        <Route path="/grades" element={<GradesPage />} />
                        <Route path="/calendar" element={<CalendarPage />} />
                        <Route path="/lesson/:lessonId" element={<LessonPage />} />
                        <Route path="/messages" element={<MessagesPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route
                          path="/parent"
                          element={
                            <RoleGuard allowedRoles={["parent"]}>
                              <ParentPortal />
                            </RoleGuard>
                          }
                        />
                        <Route
                          path="/coach-studio"
                          element={
                            <RoleGuard allowedRoles={["admin", "platform_admin", "school_admin", "tutor", "ta"]}>
                              <CoachStudio />
                            </RoleGuard>
                          }
                        />
                        <Route
                          path="/admin"
                          element={
                            <RoleGuard allowedRoles={["admin", "platform_admin", "school_admin"]}>
                              <AdminPanel />
                            </RoleGuard>
                          }
                        />
                        <Route
                          path="/grading-queue"
                          element={
                            <RoleGuard allowedRoles={["admin", "platform_admin", "school_admin", "tutor", "ta"]}>
                              <GradingQueuePage />
                            </RoleGuard>
                          }
                        />
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
  </ThemeProvider>
);

export default App;
