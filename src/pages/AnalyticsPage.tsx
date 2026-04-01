import { useRole } from "@/hooks/useRole";
import StudentAnalytics from "@/components/analytics/StudentAnalytics";
import TutorAnalytics from "@/components/analytics/TutorAnalytics";
import AdminAnalytics from "@/components/analytics/AdminAnalytics";

const AnalyticsPage = () => {
  const { role, isAdmin, isSchoolAdmin } = useRole();

  const getSubtitle = () => {
    if (isAdmin) return "Platform-wide performance metrics and insights";
    if (isSchoolAdmin) return "Institution performance overview and student insights";
    if (role === "tutor" || role === "ta") return "Course performance overview and student insights";
    return "Track your academic progress across all courses";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">{getSubtitle()}</p>
      </div>
      {isAdmin ? (
        <AdminAnalytics />
      ) : isSchoolAdmin ? (
        <AdminAnalytics institutionScoped />
      ) : role === "tutor" || role === "ta" ? (
        <TutorAnalytics />
      ) : (
        <StudentAnalytics />
      )}
    </div>
  );
};

export default AnalyticsPage;
