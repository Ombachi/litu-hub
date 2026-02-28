
-- =============================================
-- LITU HUB LMS DATABASE SCHEMA
-- =============================================

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'tutor', 'student');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  UNIQUE(user_id, role)
);

-- 4. Terms
CREATE TABLE public.terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Courses
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id UUID REFERENCES public.terms(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT 'hsl(152, 45%, 22%)',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Course Tutors (membership)
CREATE TABLE public.course_tutors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, tutor_id)
);

-- 7. Enrollments (membership)
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);

-- 8. Modules
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  "order" INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Lessons
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'reading',
  duration TEXT DEFAULT '',
  "order" INT NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Assignments
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date TIMESTAMPTZ,
  max_score INT NOT NULL DEFAULT 100,
  type TEXT NOT NULL DEFAULT 'essay',
  rubric_criteria JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Assignment Submissions
CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content TEXT DEFAULT '',
  file_url TEXT,
  score INT,
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  UNIQUE(assignment_id, student_id)
);

-- 12. Quizzes
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  time_limit INT NOT NULL DEFAULT 30,
  max_attempts INT NOT NULL DEFAULT 1,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Quiz Questions
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB DEFAULT '[]',
  correct_answer TEXT NOT NULL DEFAULT '',
  explanation TEXT DEFAULT '',
  points INT NOT NULL DEFAULT 1,
  "order" INT NOT NULL DEFAULT 0
);

-- 14. Quiz Attempts
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  score INT,
  status TEXT NOT NULL DEFAULT 'in_progress'
);

-- 15. Quiz Responses
CREATE TABLE public.quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE NOT NULL,
  response TEXT NOT NULL DEFAULT '',
  is_correct BOOLEAN DEFAULT false,
  points_earned INT DEFAULT 0,
  UNIQUE(attempt_id, question_id)
);

-- 16. Discussions
CREATE TABLE public.discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Discussion Posts
CREATE TABLE public.discussion_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID REFERENCES public.discussions(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_post_id UUID REFERENCES public.discussion_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_posts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_course_tutor(_course_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_tutors
    WHERE course_id = _course_id AND tutor_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled(_course_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = _course_id AND student_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_course(_course_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id) 
    OR public.is_course_tutor(_course_id, _user_id) 
    OR public.is_enrolled(_course_id, _user_id)
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- User Roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Only admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Terms (public read, admin write)
CREATE POLICY "Anyone can view terms" ON public.terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage terms" ON public.terms FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Courses
CREATE POLICY "Accessible courses are viewable" ON public.courses FOR SELECT TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(id, auth.uid()) OR public.is_enrolled(id, auth.uid())
);
CREATE POLICY "Tutors and admins manage courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'tutor')
);
CREATE POLICY "Course tutors and admins update courses" ON public.courses FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(id, auth.uid())
);
CREATE POLICY "Course tutors and admins delete courses" ON public.courses FOR DELETE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(id, auth.uid())
);

-- Course Tutors
CREATE POLICY "View course tutors" ON public.course_tutors FOR SELECT TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);
CREATE POLICY "Admins manage course tutors" ON public.course_tutors FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Enrollments
CREATE POLICY "View enrollments" ON public.enrollments FOR SELECT TO authenticated USING (
  student_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);
CREATE POLICY "Students self-enroll" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students or admins manage enrollment" ON public.enrollments FOR DELETE TO authenticated USING (
  student_id = auth.uid() OR public.is_admin(auth.uid())
);

-- Modules
CREATE POLICY "View modules" ON public.modules FOR SELECT TO authenticated USING (public.can_access_course(course_id, auth.uid()));
CREATE POLICY "Tutors manage modules" ON public.modules FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);
CREATE POLICY "Tutors update modules" ON public.modules FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);
CREATE POLICY "Tutors delete modules" ON public.modules FOR DELETE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);

-- Lessons
CREATE POLICY "View lessons" ON public.lessons FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.modules m WHERE m.id = module_id AND public.can_access_course(m.course_id, auth.uid()))
);
CREATE POLICY "Tutors manage lessons" ON public.lessons FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.modules m WHERE m.id = module_id AND (public.is_admin(auth.uid()) OR public.is_course_tutor(m.course_id, auth.uid())))
);
CREATE POLICY "Tutors update lessons" ON public.lessons FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.modules m WHERE m.id = module_id AND (public.is_admin(auth.uid()) OR public.is_course_tutor(m.course_id, auth.uid())))
);
CREATE POLICY "Tutors delete lessons" ON public.lessons FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.modules m WHERE m.id = module_id AND (public.is_admin(auth.uid()) OR public.is_course_tutor(m.course_id, auth.uid())))
);

-- Assignments
CREATE POLICY "View assignments" ON public.assignments FOR SELECT TO authenticated USING (public.can_access_course(course_id, auth.uid()));
CREATE POLICY "Tutors manage assignments" ON public.assignments FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);
CREATE POLICY "Tutors update assignments" ON public.assignments FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);
CREATE POLICY "Tutors delete assignments" ON public.assignments FOR DELETE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);

-- Assignment Submissions
CREATE POLICY "View own submissions" ON public.assignment_submissions FOR SELECT TO authenticated USING (
  student_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.is_course_tutor(a.course_id, auth.uid())
  )
);
CREATE POLICY "Students submit" ON public.assignment_submissions FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Update submissions" ON public.assignment_submissions FOR UPDATE TO authenticated USING (
  student_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.is_course_tutor(a.course_id, auth.uid())
  )
);

-- Quizzes
CREATE POLICY "View quizzes" ON public.quizzes FOR SELECT TO authenticated USING (public.can_access_course(course_id, auth.uid()));
CREATE POLICY "Tutors manage quizzes" ON public.quizzes FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);
CREATE POLICY "Tutors update quizzes" ON public.quizzes FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);
CREATE POLICY "Tutors delete quizzes" ON public.quizzes FOR DELETE TO authenticated USING (
  public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);

-- Quiz Questions
CREATE POLICY "View quiz questions" ON public.quiz_questions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.can_access_course(q.course_id, auth.uid()))
);
CREATE POLICY "Tutors manage questions" ON public.quiz_questions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (public.is_admin(auth.uid()) OR public.is_course_tutor(q.course_id, auth.uid())))
);
CREATE POLICY "Tutors update questions" ON public.quiz_questions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (public.is_admin(auth.uid()) OR public.is_course_tutor(q.course_id, auth.uid())))
);
CREATE POLICY "Tutors delete questions" ON public.quiz_questions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (public.is_admin(auth.uid()) OR public.is_course_tutor(q.course_id, auth.uid())))
);

-- Quiz Attempts
CREATE POLICY "View own attempts" ON public.quiz_attempts FOR SELECT TO authenticated USING (
  student_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_course_tutor(q.course_id, auth.uid())
  )
);
CREATE POLICY "Students start attempts" ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Update attempts" ON public.quiz_attempts FOR UPDATE TO authenticated USING (
  student_id = auth.uid() OR public.is_admin(auth.uid())
);

-- Quiz Responses
CREATE POLICY "View own responses" ON public.quiz_responses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_id AND (a.student_id = auth.uid() OR public.is_admin(auth.uid())))
);
CREATE POLICY "Students submit responses" ON public.quiz_responses FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid())
);
CREATE POLICY "Update responses" ON public.quiz_responses FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid())
);

-- Discussions
CREATE POLICY "View discussions" ON public.discussions FOR SELECT TO authenticated USING (public.can_access_course(course_id, auth.uid()));
CREATE POLICY "Create discussions" ON public.discussions FOR INSERT TO authenticated WITH CHECK (
  public.can_access_course(course_id, auth.uid())
);
CREATE POLICY "Update discussions" ON public.discussions FOR UPDATE TO authenticated USING (
  author_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);
CREATE POLICY "Delete discussions" ON public.discussions FOR DELETE TO authenticated USING (
  author_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_course_tutor(course_id, auth.uid())
);

-- Discussion Posts
CREATE POLICY "View discussion posts" ON public.discussion_posts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.discussions d WHERE d.id = discussion_id AND public.can_access_course(d.course_id, auth.uid()))
);
CREATE POLICY "Create posts" ON public.discussion_posts FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.discussions d WHERE d.id = discussion_id AND public.can_access_course(d.course_id, auth.uid()))
);
CREATE POLICY "Update own posts" ON public.discussion_posts FOR UPDATE TO authenticated USING (
  author_id = auth.uid() OR public.is_admin(auth.uid())
);
CREATE POLICY "Delete own posts" ON public.discussion_posts FOR DELETE TO authenticated USING (
  author_id = auth.uid() OR public.is_admin(auth.uid())
);

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
