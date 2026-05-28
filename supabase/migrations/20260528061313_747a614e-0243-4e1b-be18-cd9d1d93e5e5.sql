
-- Server-side HTML sanitizer for tutor/student rich-text content.
-- Strips dangerous tags/attributes (script, style, on* handlers, javascript:/data: urls)
-- while allowing standard formatting tags and YouTube iframe embeds used by TipTap.

CREATE OR REPLACE FUNCTION public.sanitize_html(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  out_text text;
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN input;
  END IF;

  out_text := input;

  -- Remove <script>, <style>, <object>, <embed>, <link>, <meta> blocks (with content)
  out_text := regexp_replace(out_text, '<\s*(script|style|object|embed|link|meta|form|input|button|textarea|select|option)\b[^>]*>.*?<\s*/\s*\1\s*>', '', 'gis');
  -- Remove self-closing/orphan dangerous tags
  out_text := regexp_replace(out_text, '<\s*(script|style|object|embed|link|meta|form|input|button|textarea|select|option)\b[^>]*/?\s*>', '', 'gi');

  -- Remove inline event handler attributes (onclick, onerror, onload, etc.)
  out_text := regexp_replace(out_text, '\s+on[a-z]+\s*=\s*"[^"]*"', '', 'gi');
  out_text := regexp_replace(out_text, '\s+on[a-z]+\s*=\s*''[^'']*''', '', 'gi');
  out_text := regexp_replace(out_text, '\s+on[a-z]+\s*=\s*[^\s>]+', '', 'gi');

  -- Neutralize javascript:, vbscript:, data: (except data:image) URLs in href/src
  out_text := regexp_replace(out_text, '(href|src|xlink:href)\s*=\s*"(\s*(javascript|vbscript|file)\s*:[^"]*)"', '\1="#"', 'gi');
  out_text := regexp_replace(out_text, '(href|src|xlink:href)\s*=\s*''(\s*(javascript|vbscript|file)\s*:[^'']*)''', '\1="#"', 'gi');
  out_text := regexp_replace(out_text, '(href|src|xlink:href)\s*=\s*"(\s*data\s*:(?!image/)[^"]*)"', '\1="#"', 'gi');

  -- Remove non-YouTube iframes (keep youtube.com / youtube-nocookie.com embeds used by TipTap)
  out_text := regexp_replace(
    out_text,
    '<iframe\b(?![^>]*\bsrc\s*=\s*["''](https?:)?//(www\.)?(youtube(-nocookie)?\.com|youtu\.be)/)[^>]*>.*?</iframe>',
    '', 'gis'
  );
  out_text := regexp_replace(
    out_text,
    '<iframe\b(?![^>]*\bsrc\s*=\s*["''](https?:)?//(www\.)?(youtube(-nocookie)?\.com|youtu\.be)/)[^>]*/?>',
    '', 'gi'
  );

  -- Strip style attributes (CSS-based exploits like expression(), url(javascript:))
  out_text := regexp_replace(out_text, '\s+style\s*=\s*"[^"]*"', '', 'gi');
  out_text := regexp_replace(out_text, '\s+style\s*=\s*''[^'']*''', '', 'gi');

  -- Strip HTML comments (can hide IE conditional script)
  out_text := regexp_replace(out_text, '<!--.*?-->', '', 'gs');

  RETURN out_text;
END;
$$;

COMMENT ON FUNCTION public.sanitize_html(text) IS 'Removes dangerous HTML tags/attributes from user-submitted rich text. Allows YouTube iframe embeds.';

-- Generic trigger applying sanitize_html to a configurable column (TG_ARGV[0]).
CREATE OR REPLACE FUNCTION public.tg_sanitize_html_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  col text := TG_ARGV[0];
  val text;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', col) INTO val USING NEW;
  IF val IS NOT NULL THEN
    val := public.sanitize_html(val);
    NEW := NEW #= hstore(col, val);
  END IF;
  RETURN NEW;
EXCEPTION WHEN undefined_function THEN
  -- Fallback without hstore: use json round-trip
  NEW := json_populate_record(NEW, json_build_object(col, public.sanitize_html(val)));
  RETURN NEW;
END;
$$;

-- Simpler per-table triggers (avoid hstore dependency)
CREATE OR REPLACE FUNCTION public.tg_sanitize_announcement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.content := public.sanitize_html(NEW.content);
  NEW.title := public.sanitize_html(NEW.title);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sanitize_discussion_post()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.content := public.sanitize_html(NEW.content);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sanitize_discussion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.title := public.sanitize_html(NEW.title);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sanitize_lesson()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.content := public.sanitize_html(NEW.content);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sanitize_assignment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.description := public.sanitize_html(NEW.description);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sanitize_assignment_submission()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.content := public.sanitize_html(NEW.content);
  NEW.feedback := public.sanitize_html(NEW.feedback);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sanitize_quiz()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.description := public.sanitize_html(NEW.description);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sanitize_quiz_question()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.question_text := public.sanitize_html(NEW.question_text);
  NEW.explanation := public.sanitize_html(NEW.explanation);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sanitize_quiz_response()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.response := public.sanitize_html(NEW.response);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sanitize_direct_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.content := public.sanitize_html(NEW.content);
  RETURN NEW;
END; $$;

-- Drop-and-create triggers
DROP TRIGGER IF EXISTS sanitize_announcement ON public.announcements;
CREATE TRIGGER sanitize_announcement BEFORE INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_announcement();

DROP TRIGGER IF EXISTS sanitize_discussion_post ON public.discussion_posts;
CREATE TRIGGER sanitize_discussion_post BEFORE INSERT OR UPDATE ON public.discussion_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_discussion_post();

DROP TRIGGER IF EXISTS sanitize_discussion ON public.discussions;
CREATE TRIGGER sanitize_discussion BEFORE INSERT OR UPDATE ON public.discussions
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_discussion();

DROP TRIGGER IF EXISTS sanitize_lesson ON public.lessons;
CREATE TRIGGER sanitize_lesson BEFORE INSERT OR UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_lesson();

DROP TRIGGER IF EXISTS sanitize_assignment ON public.assignments;
CREATE TRIGGER sanitize_assignment BEFORE INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_assignment();

DROP TRIGGER IF EXISTS sanitize_assignment_submission ON public.assignment_submissions;
CREATE TRIGGER sanitize_assignment_submission BEFORE INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_assignment_submission();

DROP TRIGGER IF EXISTS sanitize_quiz ON public.quizzes;
CREATE TRIGGER sanitize_quiz BEFORE INSERT OR UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_quiz();

DROP TRIGGER IF EXISTS sanitize_quiz_question ON public.quiz_questions;
CREATE TRIGGER sanitize_quiz_question BEFORE INSERT OR UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_quiz_question();

DROP TRIGGER IF EXISTS sanitize_quiz_response ON public.quiz_responses;
CREATE TRIGGER sanitize_quiz_response BEFORE INSERT OR UPDATE ON public.quiz_responses
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_quiz_response();

DROP TRIGGER IF EXISTS sanitize_direct_message ON public.direct_messages;
CREATE TRIGGER sanitize_direct_message BEFORE INSERT OR UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_sanitize_direct_message();
