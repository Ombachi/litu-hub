
-- 1. Parents can view their linked children's enrollments
CREATE POLICY "Parents view children enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parent_student_links psl
    WHERE psl.parent_id = auth.uid() AND psl.student_id = enrollments.student_id
  )
);

-- 2. Parents can view their linked children's assignment submissions
CREATE POLICY "Parents view children submissions"
ON public.assignment_submissions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parent_student_links psl
    WHERE psl.parent_id = auth.uid() AND psl.student_id = assignment_submissions.student_id
  )
);

-- 3. Parents can view their linked children's quiz attempts
CREATE POLICY "Parents view children quiz attempts"
ON public.quiz_attempts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parent_student_links psl
    WHERE psl.parent_id = auth.uid() AND psl.student_id = quiz_attempts.student_id
  )
);

-- 4. Parents can view their linked children's lesson completions
CREATE POLICY "Parents view children lesson completions"
ON public.lesson_completions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parent_student_links psl
    WHERE psl.parent_id = auth.uid() AND psl.student_id = lesson_completions.student_id
  )
);

-- 5. Update notification triggers to exclude admins from course-level notifications

CREATE OR REPLACE FUNCTION public.notify_on_new_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student RECORD;
BEGIN
  FOR student IN 
    SELECT e.student_id FROM public.enrollments e
    JOIN public.user_roles ur ON ur.user_id = e.student_id
    WHERE e.course_id = NEW.course_id AND ur.role = 'student'
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
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_new_announcement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student RECORD;
BEGIN
  FOR student IN 
    SELECT e.student_id FROM public.enrollments e
    JOIN public.user_roles ur ON ur.user_id = e.student_id
    WHERE e.course_id = NEW.course_id AND ur.role = 'student'
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
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_grade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parent RECORD;
  student_name TEXT;
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
    SELECT first_name INTO student_name FROM public.profiles WHERE user_id = NEW.student_id;
    FOR parent IN SELECT parent_id FROM public.parent_student_links WHERE student_id = NEW.student_id
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        parent.parent_id,
        COALESCE(student_name, 'Your child') || '''s Assignment Graded',
        'Score: ' || COALESCE(NEW.score::text, '—') || '. View in Parent Portal.',
        'grade',
        '/parent'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_new_module()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student RECORD;
  course_code TEXT;
BEGIN
  SELECT code INTO course_code FROM public.courses WHERE id = NEW.course_id;
  FOR student IN 
    SELECT e.student_id FROM public.enrollments e
    JOIN public.user_roles ur ON ur.user_id = e.student_id
    WHERE e.course_id = NEW.course_id AND ur.role = 'student'
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
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_new_lesson()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student RECORD;
  mod RECORD;
BEGIN
  SELECT m.course_id, m.title AS module_title, c.code AS course_code 
  INTO mod 
  FROM public.modules m 
  JOIN public.courses c ON c.id = m.course_id
  WHERE m.id = NEW.module_id;
  
  FOR student IN 
    SELECT e.student_id FROM public.enrollments e
    JOIN public.user_roles ur ON ur.user_id = e.student_id
    WHERE e.course_id = mod.course_id AND ur.role = 'student'
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
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_new_quiz()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  student RECORD;
BEGIN
  FOR student IN 
    SELECT e.student_id FROM public.enrollments e
    JOIN public.user_roles ur ON ur.user_id = e.student_id
    WHERE e.course_id = NEW.course_id AND ur.role = 'student'
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
$function$;
