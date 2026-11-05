import { useAuth } from "@/hooks/useAuth";
import StudentAttendanceSummary from "@/components/attendance/StudentAttendanceSummary";

export default function AttendancePage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">My Attendance</h1>
        <p className="mt-1 text-muted-foreground">Your attendance across all courses. Below 75% shows a warning.</p>
      </div>
      {user && <StudentAttendanceSummary studentId={user.id} />}
    </div>
  );
}
