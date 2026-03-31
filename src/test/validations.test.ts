import { describe, it, expect } from "vitest";
import { moduleSchema, lessonSchema, assignmentSchema, quizSchema, questionSchema } from "@/lib/validations";

describe("Validation Schemas", () => {
  describe("moduleSchema", () => {
    it("rejects empty title", () => {
      const result = moduleSchema.safeParse({ title: "", description: "" });
      expect(result.success).toBe(false);
    });
    it("accepts valid module", () => {
      const result = moduleSchema.safeParse({ title: "Intro to Python", description: "Basics" });
      expect(result.success).toBe(true);
    });
    it("rejects title over 200 chars", () => {
      const result = moduleSchema.safeParse({ title: "a".repeat(201) });
      expect(result.success).toBe(false);
    });
  });

  describe("lessonSchema", () => {
    it("rejects empty title", () => {
      const result = lessonSchema.safeParse({ title: "", type: "reading" });
      expect(result.success).toBe(false);
    });
    it("rejects invalid type", () => {
      const result = lessonSchema.safeParse({ title: "Lesson 1", type: "invalid" });
      expect(result.success).toBe(false);
    });
    it("accepts valid lesson", () => {
      const result = lessonSchema.safeParse({ title: "Lesson 1", type: "video", duration: "15 min" });
      expect(result.success).toBe(true);
    });
  });

  describe("assignmentSchema", () => {
    it("rejects zero max_score", () => {
      const result = assignmentSchema.safeParse({ title: "HW1", type: "essay", max_score: 0 });
      expect(result.success).toBe(false);
    });
    it("rejects penalty over 100%", () => {
      const result = assignmentSchema.safeParse({ title: "HW1", type: "essay", max_score: 100, late_penalty_percent: 150 });
      expect(result.success).toBe(false);
    });
    it("accepts valid assignment", () => {
      const result = assignmentSchema.safeParse({ title: "HW1", type: "project", max_score: 50 });
      expect(result.success).toBe(true);
    });
  });

  describe("quizSchema", () => {
    it("rejects time limit of 0", () => {
      const result = quizSchema.safeParse({ title: "Quiz 1", time_limit: 0, max_attempts: 1 });
      expect(result.success).toBe(false);
    });
    it("accepts valid quiz", () => {
      const result = quizSchema.safeParse({ title: "Quiz 1", time_limit: 30, max_attempts: 2 });
      expect(result.success).toBe(true);
    });
  });

  describe("questionSchema", () => {
    it("rejects MCQ without correct answer", () => {
      const result = questionSchema.safeParse({
        question_text: "What is 2+2?", question_type: "multiple_choice",
        options: ["3", "4"], correct_answer: "", points: 1, difficulty: "easy",
      });
      expect(result.success).toBe(false);
    });
    it("allows SAQ without correct answer", () => {
      const result = questionSchema.safeParse({
        question_text: "Explain gravity", question_type: "short_answer",
        correct_answer: "", points: 5, difficulty: "hard",
      });
      expect(result.success).toBe(true);
    });
    it("accepts valid MCQ", () => {
      const result = questionSchema.safeParse({
        question_text: "What is 2+2?", question_type: "multiple_choice",
        options: ["3", "4"], correct_answer: "4", points: 1, difficulty: "medium",
      });
      expect(result.success).toBe(true);
    });
  });
});
