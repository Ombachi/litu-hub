-- Fix discussions INSERT policy: allow coaches/admins to create discussions for courses they manage
DROP POLICY IF EXISTS "Create discussions" ON public.discussions;
CREATE POLICY "Create discussions" ON public.discussions
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid() AND (
    can_manage_course(course_id, auth.uid()) OR can_access_course(course_id, auth.uid())
  )
);

-- Fix discussion_posts INSERT: ensure author_id matches and has course access
DROP POLICY IF EXISTS "Create posts" ON public.discussion_posts;
CREATE POLICY "Create posts" ON public.discussion_posts
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM discussions d
      WHERE d.id = discussion_posts.discussion_id
        AND can_access_course(d.course_id, auth.uid())
    )
  )
);

-- Also allow tutors to delete discussion posts they moderate
DROP POLICY IF EXISTS "Delete own posts" ON public.discussion_posts;
CREATE POLICY "Delete own posts" ON public.discussion_posts
FOR DELETE TO authenticated
USING (
  author_id = auth.uid() OR is_admin(auth.uid()) OR (
    EXISTS (
      SELECT 1 FROM discussions d
      WHERE d.id = discussion_posts.discussion_id
        AND is_course_tutor(d.course_id, auth.uid())
    )
  )
);

-- Allow tutors to view all profiles (needed for grading queue joins)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR is_admin(auth.uid()) OR has_role(auth.uid(), 'tutor'::app_role) OR has_role(auth.uid(), 'ta'::app_role)
);

-- Allow tutors/admins to view all submissions (grading queue)
DROP POLICY IF EXISTS "View own submissions" ON public.assignment_submissions;
CREATE POLICY "View own submissions" ON public.assignment_submissions
FOR SELECT TO authenticated
USING (
  student_id = auth.uid() OR is_admin(auth.uid()) OR (
    EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (is_course_tutor(a.course_id, auth.uid()) OR is_tutor_or_ta(a.course_id, auth.uid()))
    )
  )
);