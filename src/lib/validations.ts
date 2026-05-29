import { z } from "zod";

// ---- Module ----
export const moduleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be under 200 characters"),
  description: z.string().max(1000, "Description must be under 1000 characters").optional().default(""),
});
export type ModuleFormData = z.infer<typeof moduleSchema>;

// ---- Lesson ----
export const lessonSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be under 200 characters"),
  type: z.enum(["reading", "video", "activity", "quiz"], { required_error: "Type is required" }),
  duration: z.string().max(50).optional().default(""),
  content: z.string().max(50000, "Content is too long").optional().default(""),
});
export type LessonFormData = z.infer<typeof lessonSchema>;

// ---- Assignment ----
export const assignmentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be under 200 characters"),
  description: z.string().max(5000, "Description must be under 5000 characters").optional().default(""),
  type: z.enum(["essay", "project", "code", "presentation"], { required_error: "Type is required" }),
  due_date: z.string().optional().default(""),
  max_score: z.number().min(1, "Max score must be at least 1").max(10000, "Max score is too high"),
  allow_late_submissions: z.boolean().optional().default(true),
  late_penalty_percent: z.number().min(0).max(100, "Penalty cannot exceed 100%").optional().default(0),
  grace_period_hours: z.number().min(0).max(720, "Grace period too long").optional().default(0),
});
export type AssignmentFormData = z.infer<typeof assignmentSchema>;

// ---- Quiz ----
export const ASSESSMENT_CATEGORIES = ["CAT 1", "CAT 2", "RAT", "Main Exam", "General"] as const;
export type AssessmentCategory = typeof ASSESSMENT_CATEGORIES[number];

export const quizSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be under 200 characters"),
  description: z.string().max(2000, "Description must be under 2000 characters").optional().default(""),
  time_limit: z.number().min(1, "Time limit must be at least 1 minute").max(600, "Time limit cannot exceed 10 hours"),
  max_attempts: z.number().min(1, "Must allow at least 1 attempt").max(100, "Too many attempts"),
  due_date: z.string().optional().default(""),
  assessment_category: z.enum(ASSESSMENT_CATEGORIES).default("General"),
  exam_period: z.string().max(100).optional().default(""),
});
export type QuizFormData = z.infer<typeof quizSchema>;

// ---- Question ----
export const questionSchema = z.object({
  question_text: z.string().trim().min(1, "Question text is required").max(5000, "Question text is too long"),
  question_type: z.enum(["multiple_choice", "true_false", "short_answer", "matching"]),
  options: z.array(z.string()).optional().default([]),
  correct_answer: z.string().optional().default(""),
  explanation: z.string().max(2000).optional().default(""),
  points: z.number().min(1, "Points must be at least 1").max(1000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  competency_tag: z.string().max(100).optional().default(""),
  pool_name: z.string().max(100).optional().default(""),
}).refine(
  (data) => data.question_type === "short_answer" || data.correct_answer.length > 0,
  { message: "Correct answer is required for this question type", path: ["correct_answer"] }
);
export type QuestionFormData = z.infer<typeof questionSchema>;
