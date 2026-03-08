
-- Storage policies for submissions bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload to submissions" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submissions');

CREATE POLICY "Users can view own uploads in submissions" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'submissions');

CREATE POLICY "Users can update own uploads in submissions" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'submissions' AND (storage.foldername(name))[1] IN ('lessons', 'discussions', 'quiz-answers', (auth.uid())::text));

-- Notification trigger function: notify on grade
CREATE OR REPLACE FUNCTION public.notify_on_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'graded' AND (OLD.status IS DISTINCT FROM 'graded') THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.student_id,
      'Assignment Graded',
      'Your submission has been graded. Score: ' || COALESCE(NEW.score::text, '—') || '. Check your grades.',
      'grade',
      '/grades'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_grade
AFTER UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_grade();

-- Notification trigger: notify enrolled students on new assignment
CREATE OR REPLACE FUNCTION public.notify_on_new_assignment()
RETURNS trigger
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
      'New Assignment: ' || NEW.title,
      'A new assignment has been posted. Due: ' || COALESCE(to_char(NEW.due_date, 'Mon DD, YYYY'), 'No deadline'),
      'assignment',
      '/assignment/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_assignment
AFTER INSERT ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_assignment();

-- Notification trigger: notify enrolled students on new quiz
CREATE OR REPLACE FUNCTION public.notify_on_new_quiz()
RETURNS trigger
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
      'New Quiz: ' || NEW.title,
      'A new quiz has been posted. Due: ' || COALESCE(to_char(NEW.due_date, 'Mon DD, YYYY'), 'No deadline'),
      'quiz',
      '/quizzes?take=' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_quiz
AFTER INSERT ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_quiz();
