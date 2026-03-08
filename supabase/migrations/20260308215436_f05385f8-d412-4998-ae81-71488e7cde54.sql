
CREATE OR REPLACE FUNCTION public.notify_on_tutor_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  course_record RECORD;
BEGIN
  SELECT code, title INTO course_record FROM public.courses WHERE id = NEW.course_id;
  
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    NEW.tutor_id,
    'Course Assigned: ' || COALESCE(course_record.code, '') || ' — ' || COALESCE(course_record.title, ''),
    'You have been assigned to teach ' || COALESCE(course_record.code, '') || ' ' || COALESCE(course_record.title, '') || '. Check your dashboard.',
    'course',
    '/course/' || NEW.course_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tutor_assigned
  AFTER INSERT ON public.course_tutors
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_tutor_assigned();
