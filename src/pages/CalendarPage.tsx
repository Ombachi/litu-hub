import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAssignments, useQuizzes } from "@/hooks/useData";
import { ChevronLeft, ChevronRight, FileText, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "assignment" | "quiz";
  courseCode?: string;
  courseId?: string;
}

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { data: assignments } = useAssignments();
  const { data: quizzes } = useQuizzes();
  const navigate = useNavigate();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const events = useMemo<CalendarEvent[]>(() => {
    const items: CalendarEvent[] = [];
    assignments?.forEach((a: any) => {
      if (a.due_date) items.push({ id: a.id, title: a.title, date: new Date(a.due_date), type: "assignment", courseCode: a.courses?.code, courseId: a.course_id });
    });
    quizzes?.forEach((q: any) => {
      if (q.due_date) items.push({ id: q.id, title: q.title, date: new Date(q.due_date), type: "quiz", courseCode: q.courses?.code, courseId: q.course_id });
    });
    return items;
  }, [assignments, quizzes]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getEventsForDay = (day: number) =>
    events.filter((e) => e.date.getFullYear() === year && e.date.getMonth() === month && e.date.getDate() === day);

  const selectedEvents = selectedDate
    ? events.filter((e) => e.date.toDateString() === selectedDate.toDateString())
    : [];

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === "assignment") {
      navigate(`/assignment/${event.id}`);
    } else {
      navigate(`/quizzes?take=${event.id}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Calendar</h1>
        <p className="mt-1 text-muted-foreground">Track all due dates and deadlines</p>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="rounded-lg p-2 hover:bg-secondary transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-display text-lg font-bold">{MONTHS[month]} {year}</h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="rounded-lg p-2 hover:bg-secondary transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r bg-muted/20" />;
            const dayEvents = getEventsForDay(day);
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            const isSelected = selectedDate?.getFullYear() === year && selectedDate?.getMonth() === month && selectedDate?.getDate() === day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(new Date(year, month, day))}
                className={cn(
                  "min-h-[80px] border-b border-r p-1.5 text-left transition-colors hover:bg-secondary/50",
                  isSelected && "bg-primary/5 ring-1 ring-primary",
                )}
              >
                <span className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                  isToday && "bg-primary text-primary-foreground",
                )}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                        e.type === "assignment" ? "bg-chart-1/20 text-chart-1" : "bg-chart-2/20 text-chart-2"
                      )}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day details with deep-links */}
      {selectedDate && (
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-3">
            {selectedDate.toLocaleDateString("en-KE", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          {!selectedEvents.length ? (
            <p className="text-sm text-muted-foreground">No events on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleEventClick(e)}
                  className="flex items-center gap-3 rounded-lg border p-3 w-full text-left hover:bg-secondary/50 transition-colors"
                >
                  {e.type === "assignment" ? (
                    <FileText className="h-5 w-5 text-chart-1" />
                  ) : (
                    <Brain className="h-5 w-5 text-chart-2" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.courseCode} • {e.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
