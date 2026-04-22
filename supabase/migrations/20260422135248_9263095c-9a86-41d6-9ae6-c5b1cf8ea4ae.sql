-- Public bucket: logos remain accessible via direct URL through the CDN,
-- but listing the bucket via the API is no longer allowed.
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;