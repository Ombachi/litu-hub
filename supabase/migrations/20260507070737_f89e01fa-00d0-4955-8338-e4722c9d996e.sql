
DROP POLICY IF EXISTS "Users upload to own or shared folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own uploads in submissions" ON storage.objects;

CREATE POLICY "Users upload to own or shared folders"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'submissions'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR (
      (storage.foldername(name))[1] = ANY (ARRAY['lessons','discussions','quiz-answers'])
      AND (storage.foldername(name))[2] = (auth.uid())::text
    )
  )
);

CREATE POLICY "Users can update own uploads in submissions"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'submissions'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR (
      (storage.foldername(name))[1] = ANY (ARRAY['lessons','discussions','quiz-answers'])
      AND (storage.foldername(name))[2] = (auth.uid())::text
    )
  )
);
