-- =============================================
-- 1. Direct Messages Table for Real-time Chat
-- =============================================
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own messages" ON public.direct_messages
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users send messages" ON public.direct_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Receiver marks read" ON public.direct_messages
  FOR UPDATE USING (receiver_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- =============================================
-- 2. Course Resources/Files Library
-- =============================================
CREATE TABLE public.course_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  file_url text NOT NULL,
  file_type text DEFAULT 'document',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View course resources" ON public.course_resources
  FOR SELECT USING (can_access_course(course_id, auth.uid()));

CREATE POLICY "Tutors manage resources" ON public.course_resources
  FOR ALL USING (can_manage_course(course_id, auth.uid()));

-- =============================================
-- 3. Course Announcements (distinct from discussions)
-- =============================================
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  author_id uuid,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  pinned boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View announcements" ON public.announcements
  FOR SELECT USING (can_access_course(course_id, auth.uid()));

CREATE POLICY "Tutors create announcements" ON public.announcements
  FOR INSERT WITH CHECK (can_manage_course(course_id, auth.uid()) AND author_id = auth.uid());

CREATE POLICY "Tutors update announcements" ON public.announcements
  FOR UPDATE USING (can_manage_course(course_id, auth.uid()));

CREATE POLICY "Tutors delete announcements" ON public.announcements
  FOR DELETE USING (can_manage_course(course_id, auth.uid()));

-- =============================================
-- 4. Late Submission Policies on Assignments
-- =============================================
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS late_penalty_percent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS grace_period_hours integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS allow_late_submissions boolean DEFAULT true;

-- =============================================
-- 5. Triggers for Notifications on New Modules/Lessons
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_on_new_module()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student RECORD;
  course_code TEXT;
BEGIN
  SELECT code INTO course_code FROM public.courses WHERE id = NEW.course_id;
  FOR student IN SELECT student_id FROM public.enrollments WHERE course_id = NEW.course_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      student.student_id,
      'New Module: ' || NEW.title,
      'A new module "' || NEW.title || '" has been added to ' || COALESCE(course_code, 'your course') || '.',
      'module',
      '/course/' || NEW.course_id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_module ON public.modules;
CREATE TRIGGER trigger_notify_new_module
AFTER INSERT ON public.modules
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_module();

CREATE OR REPLACE FUNCTION public.notify_on_new_lesson()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student RECORD;
  mod RECORD;
BEGIN
  SELECT m.course_id, m.title AS module_title, c.code AS course_code 
  INTO mod 
  FROM public.modules m 
  JOIN public.courses c ON c.id = m.course_id
  WHERE m.id = NEW.module_id;
  
  FOR student IN SELECT student_id FROM public.enrollments WHERE course_id = mod.course_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      student.student_id,
      'New Lesson: ' || NEW.title,
      'A new lesson "' || NEW.title || '" has been added to ' || COALESCE(mod.module_title, 'the module') || '.',
      'lesson',
      '/lesson/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_lesson ON public.lessons;
CREATE TRIGGER trigger_notify_new_lesson
AFTER INSERT ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_lesson();

-- =============================================
-- 6. Trigger for Announcement Notifications
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_on_new_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student RECORD;
BEGIN
  FOR student IN SELECT student_id FROM public.enrollments WHERE course_id = NEW.course_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      student.student_id,
      '📢 ' || NEW.title,
      LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
      'announcement',
      '/course/' || NEW.course_id || '?tab=announcements'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_announcement ON public.announcements;
CREATE TRIGGER trigger_notify_new_announcement
AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_announcement();