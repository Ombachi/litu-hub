
-- ============================================================
-- 1. Fix all RESTRICTIVE policies → make them PERMISSIVE
--    Drop and recreate every policy on every table
-- ============================================================

-- ---- TERMS ----
DROP POLICY IF EXISTS "Admins manage terms" ON public.terms;
DROP POLICY IF EXISTS "Anyone can view terms" ON public.terms;
CREATE POLICY "Admins manage terms" ON public.terms FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Anyone can view terms" ON public.terms FOR SELECT TO authenticated USING (true);

-- ---- COURSES ----
DROP POLICY IF EXISTS "Accessible courses are viewable" ON public.courses;
DROP POLICY IF EXISTS "Course tutors and admins delete courses" ON public.courses;
DROP POLICY IF EXISTS "Course tutors and admins update courses" ON public.courses;
DROP POLICY IF EXISTS "Tutors and admins manage courses" ON public.courses;
-- Allow all authenticated users to browse courses
CREATE POLICY "All authenticated can view courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tutors and admins insert courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'tutor'::app_role));
CREATE POLICY "Tutors and admins update courses" ON public.courses FOR UPDATE TO authenticated USING (is_admin(auth.uid()) OR is_course_tutor(id, auth.uid()));
CREATE POLICY "Tutors and admins delete courses" ON public.courses FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR is_course_tutor(id, auth.uid()));

-- ---- ENROLLMENTS ----
DROP POLICY IF EXISTS "Students or admins manage enrollment" ON public.enrollments;
DROP POLICY IF EXISTS "Students self-enroll" ON public.enrollments;
DROP POLICY IF EXISTS "View enrollments" ON public.enrollments;
CREATE POLICY "Students self-enroll" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "View enrollments" ON public.enrollments FOR SELECT TO authenticated USING (student_id = auth.uid() OR is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));
CREATE POLICY "Students or admins delete enrollment" ON public.enrollments FOR DELETE TO authenticated USING (student_id = auth.uid() OR is_admin(auth.uid()));

-- ---- MODULES ----
DROP POLICY IF EXISTS "Tutors delete modules" ON public.modules;
DROP POLICY IF EXISTS "Tutors manage modules" ON public.modules;
DROP POLICY IF EXISTS "Tutors update modules" ON public.modules;
DROP POLICY IF EXISTS "View modules" ON public.modules;
CREATE POLICY "View modules" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tutors insert modules" ON public.modules FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));
CREATE POLICY "Tutors update modules" ON public.modules FOR UPDATE TO authenticated USING (is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));
CREATE POLICY "Tutors delete modules" ON public.modules FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));

-- ---- LESSONS ----
DROP POLICY IF EXISTS "Tutors delete lessons" ON public.lessons;
DROP POLICY IF EXISTS "Tutors manage lessons" ON public.lessons;
DROP POLICY IF EXISTS "Tutors update lessons" ON public.lessons;
DROP POLICY IF EXISTS "View lessons" ON public.lessons;
CREATE POLICY "View lessons" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tutors insert lessons" ON public.lessons FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM modules m WHERE m.id = lessons.module_id AND (is_admin(auth.uid()) OR is_course_tutor(m.course_id, auth.uid()))));
CREATE POLICY "Tutors update lessons" ON public.lessons FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM modules m WHERE m.id = lessons.module_id AND (is_admin(auth.uid()) OR is_course_tutor(m.course_id, auth.uid()))));
CREATE POLICY "Tutors delete lessons" ON public.lessons FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM modules m WHERE m.id = lessons.module_id AND (is_admin(auth.uid()) OR is_course_tutor(m.course_id, auth.uid()))));

-- ---- ASSIGNMENTS ----
DROP POLICY IF EXISTS "Tutors delete assignments" ON public.assignments;
DROP POLICY IF EXISTS "Tutors manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Tutors update assignments" ON public.assignments;
DROP POLICY IF EXISTS "View assignments" ON public.assignments;
CREATE POLICY "View assignments" ON public.assignments FOR SELECT TO authenticated USING (can_access_course(course_id, auth.uid()));
CREATE POLICY "Tutors insert assignments" ON public.assignments FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));
CREATE POLICY "Tutors update assignments" ON public.assignments FOR UPDATE TO authenticated USING (is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));
CREATE POLICY "Tutors delete assignments" ON public.assignments FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));

-- ---- ASSIGNMENT_SUBMISSIONS ----
DROP POLICY IF EXISTS "Students submit" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Update submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "View own submissions" ON public.assignment_submissions;
CREATE POLICY "Students submit" ON public.assignment_submissions FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "View own submissions" ON public.assignment_submissions FOR SELECT TO authenticated USING (student_id = auth.uid() OR is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_submissions.assignment_id AND is_course_tutor(a.course_id, auth.uid())));
CREATE POLICY "Update submissions" ON public.assignment_submissions FOR UPDATE TO authenticated USING (student_id = auth.uid() OR is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_submissions.assignment_id AND is_course_tutor(a.course_id, auth.uid())));

-- ---- QUIZZES ----
DROP POLICY IF EXISTS "Tutors delete quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Tutors manage quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Tutors update quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "View quizzes" ON public.quizzes;
CREATE POLICY "View quizzes" ON public.quizzes FOR SELECT TO authenticated USING (can_access_course(course_id, auth.uid()));
CREATE POLICY "Tutors insert quizzes" ON public.quizzes FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));
CREATE POLICY "Tutors update quizzes" ON public.quizzes FOR UPDATE TO authenticated USING (is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));
CREATE POLICY "Tutors delete quizzes" ON public.quizzes FOR DELETE TO authenticated USING (is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));

-- ---- QUIZ_QUESTIONS ----
DROP POLICY IF EXISTS "Tutors delete questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Tutors manage questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Tutors update questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "View quiz questions" ON public.quiz_questions;
CREATE POLICY "View quiz questions" ON public.quiz_questions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_questions.quiz_id AND can_access_course(q.course_id, auth.uid())));
CREATE POLICY "Tutors insert questions" ON public.quiz_questions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_questions.quiz_id AND (is_admin(auth.uid()) OR is_course_tutor(q.course_id, auth.uid()))));
CREATE POLICY "Tutors update questions" ON public.quiz_questions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_questions.quiz_id AND (is_admin(auth.uid()) OR is_course_tutor(q.course_id, auth.uid()))));
CREATE POLICY "Tutors delete questions" ON public.quiz_questions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_questions.quiz_id AND (is_admin(auth.uid()) OR is_course_tutor(q.course_id, auth.uid()))));

-- ---- QUIZ_ATTEMPTS ----
DROP POLICY IF EXISTS "Students start attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Update attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "View own attempts" ON public.quiz_attempts;
CREATE POLICY "Students start attempts" ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "View own attempts" ON public.quiz_attempts FOR SELECT TO authenticated USING (student_id = auth.uid() OR is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_attempts.quiz_id AND is_course_tutor(q.course_id, auth.uid())));
CREATE POLICY "Update attempts" ON public.quiz_attempts FOR UPDATE TO authenticated USING (student_id = auth.uid() OR is_admin(auth.uid()));

-- ---- QUIZ_RESPONSES ----
DROP POLICY IF EXISTS "Students submit responses" ON public.quiz_responses;
DROP POLICY IF EXISTS "Update responses" ON public.quiz_responses;
DROP POLICY IF EXISTS "View own responses" ON public.quiz_responses;
CREATE POLICY "Students submit responses" ON public.quiz_responses FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM quiz_attempts a WHERE a.id = quiz_responses.attempt_id AND a.student_id = auth.uid()));
CREATE POLICY "View own responses" ON public.quiz_responses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM quiz_attempts a WHERE a.id = quiz_responses.attempt_id AND (a.student_id = auth.uid() OR is_admin(auth.uid()))));
CREATE POLICY "Update responses" ON public.quiz_responses FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM quiz_attempts a WHERE a.id = quiz_responses.attempt_id AND a.student_id = auth.uid()));

-- ---- DISCUSSIONS ----
DROP POLICY IF EXISTS "Create discussions" ON public.discussions;
DROP POLICY IF EXISTS "Delete discussions" ON public.discussions;
DROP POLICY IF EXISTS "Update discussions" ON public.discussions;
DROP POLICY IF EXISTS "View discussions" ON public.discussions;
CREATE POLICY "View discussions" ON public.discussions FOR SELECT TO authenticated USING (can_access_course(course_id, auth.uid()));
CREATE POLICY "Create discussions" ON public.discussions FOR INSERT TO authenticated WITH CHECK (can_access_course(course_id, auth.uid()));
CREATE POLICY "Update discussions" ON public.discussions FOR UPDATE TO authenticated USING (author_id = auth.uid() OR is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));
CREATE POLICY "Delete discussions" ON public.discussions FOR DELETE TO authenticated USING (author_id = auth.uid() OR is_admin(auth.uid()) OR is_course_tutor(course_id, auth.uid()));

-- ---- DISCUSSION_POSTS ----
DROP POLICY IF EXISTS "Create posts" ON public.discussion_posts;
DROP POLICY IF EXISTS "Delete own posts" ON public.discussion_posts;
DROP POLICY IF EXISTS "Update own posts" ON public.discussion_posts;
DROP POLICY IF EXISTS "View discussion posts" ON public.discussion_posts;
CREATE POLICY "View discussion posts" ON public.discussion_posts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM discussions d WHERE d.id = discussion_posts.discussion_id AND can_access_course(d.course_id, auth.uid())));
CREATE POLICY "Create posts" ON public.discussion_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM discussions d WHERE d.id = discussion_posts.discussion_id AND can_access_course(d.course_id, auth.uid())));
CREATE POLICY "Update own posts" ON public.discussion_posts FOR UPDATE TO authenticated USING (author_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY "Delete own posts" ON public.discussion_posts FOR DELETE TO authenticated USING (author_id = auth.uid() OR is_admin(auth.uid()));

-- ---- PROFILES ----
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ---- USER_ROLES ----
DROP POLICY IF EXISTS "Only admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY "Only admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ---- COURSE_TUTORS ----
DROP POLICY IF EXISTS "Admins manage course tutors" ON public.course_tutors;
DROP POLICY IF EXISTS "View course tutors" ON public.course_tutors;
CREATE POLICY "View course tutors" ON public.course_tutors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage course tutors" ON public.course_tutors FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ============================================================
-- 2. Recreate the missing trigger for auto-creating profiles
-- ============================================================
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. Create storage bucket for assignment submissions
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for submissions bucket
CREATE POLICY "Students upload submissions" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Students view own submissions" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Tutors view all submissions" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'submissions');
