import { lazy, Suspense } from "react";
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
import BrandingProvider from "./components/BrandingProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import { DashboardSkeleton, ListPageSkeleton, DetailPageSkeleton, GradingQueueSkeleton } from "./components/PageSkeleton";

// Lazy-loaded route components
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CoursePage = lazy(() => import("./pages/CoursePage"));
const AssignmentsPage = lazy(() => import("./pages/AssignmentsPage"));
const AssignmentDetailPage = lazy(() => import("./pages/AssignmentDetailPage"));
const QuizzesPage = lazy(() => import("./pages/QuizzesPage"));
const DiscussionsPage = lazy(() => import("./pages/DiscussionsPage"));
const DiscussionThreadPage = lazy(() => import("./pages/DiscussionThreadPage"));
const CoachStudio = lazy(() => import("./pages/CoachStudio"));
const GradesPage = lazy(() => import("./pages/GradesPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const LessonPage = lazy(() => import("./pages/LessonPage"));
const GradingQueuePage = lazy(() => import("./pages/GradingQueuePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const ParentPortal = lazy(() => import("./pages/ParentPortal"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const FeesPage = lazy(() => import("./pages/FeesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageFallback = () => <DashboardSkeleton />;

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Suspense fallback={<PageFallback />}><AuthPage /></Suspense>} />
              <Route path="/forgot-password" element={<Suspense fallback={<PageFallback />}><ForgotPasswordPage /></Suspense>} />
              <Route path="/reset-password" element={<Suspense fallback={<PageFallback />}><ResetPasswordPage /></Suspense>} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <BrandingProvider>
                    <AppLayout>
                      <ErrorBoundary>
                        <Routes>
                          <Route path="/" element={<Suspense fallback={<DashboardSkeleton />}><Dashboard /></Suspense>} />
                          <Route path="/course/:courseId" element={<ErrorBoundary><Suspense fallback={<DetailPageSkeleton />}><CoursePage /></Suspense></ErrorBoundary>} />
                          <Route path="/assignments" element={<ErrorBoundary><Suspense fallback={<ListPageSkeleton />}><AssignmentsPage /></Suspense></ErrorBoundary>} />
                          <Route path="/assignment/:assignmentId" element={<ErrorBoundary><Suspense fallback={<DetailPageSkeleton />}><AssignmentDetailPage /></Suspense></ErrorBoundary>} />
                          <Route path="/quizzes" element={<ErrorBoundary><Suspense fallback={<ListPageSkeleton />}><QuizzesPage /></Suspense></ErrorBoundary>} />
                          <Route path="/discussions" element={<ErrorBoundary><Suspense fallback={<ListPageSkeleton />}><DiscussionsPage /></Suspense></ErrorBoundary>} />
                          <Route path="/discussion/:discussionId" element={<ErrorBoundary><Suspense fallback={<DetailPageSkeleton />}><DiscussionThreadPage /></Suspense></ErrorBoundary>} />
                          <Route path="/grades" element={<ErrorBoundary><Suspense fallback={<ListPageSkeleton />}><GradesPage /></Suspense></ErrorBoundary>} />
                          <Route path="/calendar" element={<ErrorBoundary><Suspense fallback={<ListPageSkeleton />}><CalendarPage /></Suspense></ErrorBoundary>} />
                          <Route path="/lesson/:lessonId" element={<ErrorBoundary><Suspense fallback={<DetailPageSkeleton />}><LessonPage /></Suspense></ErrorBoundary>} />
                          <Route path="/messages" element={<ErrorBoundary><Suspense fallback={<ListPageSkeleton />}><MessagesPage /></Suspense></ErrorBoundary>} />
                          <Route path="/analytics" element={<ErrorBoundary><Suspense fallback={<DashboardSkeleton />}><AnalyticsPage /></Suspense></ErrorBoundary>} />
                          <Route path="/profile" element={<ErrorBoundary><Suspense fallback={<DetailPageSkeleton />}><ProfilePage /></Suspense></ErrorBoundary>} />
                          <Route path="/fees" element={<RoleGuard allowedRoles={["student","parent","school_admin","platform_admin"]}><ErrorBoundary><Suspense fallback={<ListPageSkeleton />}><FeesPage /></Suspense></ErrorBoundary></RoleGuard>} />
                          <Route
                            path="/parent"
                            element={
                              <RoleGuard allowedRoles={["parent"]}>
                                <ErrorBoundary><Suspense fallback={<DashboardSkeleton />}><ParentPortal /></Suspense></ErrorBoundary>
                              </RoleGuard>
                            }
                          />
                          <Route
                            path="/coach-studio"
                            element={
                              <RoleGuard allowedRoles={["platform_admin", "school_admin", "tutor", "ta"]}>
                                <ErrorBoundary><Suspense fallback={<ListPageSkeleton />}><CoachStudio /></Suspense></ErrorBoundary>
                              </RoleGuard>
                            }
                          />
                          <Route
                            path="/admin"
                            element={
                              <RoleGuard allowedRoles={["platform_admin", "school_admin"]}>
                                <ErrorBoundary><Suspense fallback={<DashboardSkeleton />}><AdminPanel /></Suspense></ErrorBoundary>
                              </RoleGuard>
                            }
                          />
                          <Route
                            path="/grading-queue"
                            element={
                              <RoleGuard allowedRoles={["platform_admin", "school_admin", "tutor", "ta"]}>
                                <ErrorBoundary><Suspense fallback={<GradingQueueSkeleton />}><GradingQueuePage /></Suspense></ErrorBoundary>
                              </RoleGuard>
                            }
                          />
                          <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
                        </Routes>
                      </ErrorBoundary>
                    </AppLayout>
                    </BrandingProvider>
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
