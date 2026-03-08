
-- Fix profiles RLS: allow all authenticated users to see profiles (needed for messaging, announcements, discussions)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "All authenticated can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Create message_attachments storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for message-attachments bucket
CREATE POLICY "Users upload message attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users view message attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'message-attachments');

-- Add file_url column to direct_messages for attachments
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS file_url text DEFAULT NULL;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS file_name text DEFAULT NULL;
