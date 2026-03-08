import { useRole } from "@/hooks/useRole";
import StudentAnalytics from "@/components/analytics/StudentAnalytics";
import TutorAnalytics from "@/components/analytics/TutorAnalytics";

const AnalyticsPage = () => {
  const { isCoach } = useRole();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          {isCoach ? "Course performance overview and student insights" : "Track your academic progress across all courses"}
        </p>
      </div>
      {isCoach ? <TutorAnalytics /> : <StudentAnalytics />}
    </div>
  );
};

export default AnalyticsPage;
